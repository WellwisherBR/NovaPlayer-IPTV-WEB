<?php
/**
 * Proxy + parser de M3U/M3U8.
 * Recebe {url} ou {text} (conteúdo do arquivo enviado pelo navegador)
 * e devolve JSON já organizado para o player. Sem banco e sem sessão.
 */
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') json_error('Método não permitido.', 405);
$data = json_from_request();

try {
    if (!empty($data['text'])) {
        $text = (string) $data['text'];
    } elseif (!empty($data['url'])) {
        $url = safe_remote_url((string) $data['url']);
        $text = http_get($url, ['Accept' => 'application/vnd.apple.mpegurl,text/plain,*/*']);
    } else {
        json_error('Informe a URL ou o conteúdo da playlist.', 400);
    }
    if (strlen($text) > PLAYLIST_MAX_BYTES) json_error('Playlist muito grande.', 400);
    if (!stripos($text, '#EXTM3U') && substr_count($text, '#EXTINF') === 0) {
        json_error('O conteúdo não parece ser uma playlist M3U válida.', 422);
    }
    json_ok(parse_m3u($text, (string) ($data['url'] ?? '')));
} catch (Throwable $e) {
    json_error($e->getMessage(), 422);
}

function resolve_m3u_url(string $base, string $relative): string
{
    if (preg_match('#^https?://#i', $relative)) return $relative;
    if ($base === '') return $relative;
    $p = parse_url($base);
    if (!$p || empty($p['scheme']) || empty($p['host'])) return $relative;
    $origin = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
    if (str_starts_with($relative, '/')) return $origin . $relative;
    $dir = rtrim(str_replace('\\', '/', dirname($p['path'] ?? '/')), '/');
    $parts = [];
    foreach (explode('/', $dir . '/' . $relative) as $seg) {
        if ($seg === '' || $seg === '.') continue;
        if ($seg === '..') { array_pop($parts); continue; }
        $parts[] = $seg;
    }
    return $origin . '/' . implode('/', $parts);
}

function parse_m3u(string $text, string $baseUrl = ''): array
{
    $lines = preg_split('/\r\n|\r|\n/', $text) ?: [];
    $channels = []; $movies = []; $series = [];
    $seriesIndex = []; $liveGroups = []; $movieGroups = []; $seriesGroups = [];
    $extinf = null; $groupOverride = null; $number = 0;

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            if (str_starts_with($line, '#EXTGRP:')) $groupOverride = trim(substr($line, 8));
            if (str_starts_with($line, '#EXTINF:')) $extinf = parse_extinf_line($line);
            continue;
        }
        if ($baseUrl !== '' && !preg_match('#^https?://#i', $line)) {
            $line = resolve_m3u_url($baseUrl, $line);
        }
        if (!$extinf) {
            $extinf = ['name' => basename(parse_url($line, PHP_URL_PATH) ?: 'Canal'), 'attrs' => []];
        }
        $attrs = $extinf['attrs'];
        $group = $groupOverride ?: ($attrs['group-title'] ?? 'Outros');
        $name = clean_string($extinf['name'], 180) ?: ('Canal ' . ($number + 1));
        $logo = $attrs['tvg-logo'] ?? '';
        if ($logo !== '' && !filter_var($logo, FILTER_VALIDATE_URL)) $logo = '';
        $type = detect_content_type($group . ' ' . $line . ' ' . $name);
        $id = md5($name . '|' . $line);
        $number++;

        if ($type === 'live') {
            $liveGroups[$group] = true;
            $channels[] = [
                'id' => $id, 'name' => $name, 'logo' => $logo, 'group' => $group,
                'url' => $line, 'number' => (int) ($attrs['tvg-chno'] ?? $attrs['chno'] ?? $number),
                'catchup' => (!empty($attrs['catchup']) || !empty($attrs['tvg-rec'])) ? true : false,
            ];
        } elseif ($type === 'movie') {
            $movieGroups[$group] = true;
            $movies[] = [
                'id' => $id, 'name' => $name, 'poster' => $logo, 'group' => $group,
                'url' => $line, 'year' => null, 'genre' => '', 'description' => '',
            ];
        } else {
            $parsed = parse_episode_title($name);
            $seriesName = $parsed['series'] ?: $name;
            $seriesId = md5($seriesName);
            $seriesGroups[$group] = true;
            if (!isset($seriesIndex[$seriesId])) {
                $seriesIndex[$seriesId] = count($series);
                $series[] = [
                    'id' => $seriesId, 'name' => $seriesName, 'poster' => $logo, 'group' => $group,
                    'description' => '', 'year' => null, 'genre' => '', 'episodes' => [],
                ];
            }
            $series[$seriesIndex[$seriesId]]['episodes'][] = [
                'id' => $id, 'season' => $parsed['season'] ?: 1, 'episode' => $parsed['episode'] ?: 1,
                'name' => $name, 'description' => '', 'poster' => $logo, 'url' => $line,
            ];
        }
        $extinf = null;
        $groupOverride = null;
    }

    return [
        'channels' => $channels, 'movies' => $movies, 'series' => $series,
        'categories' => [
            'live' => array_keys($liveGroups),
            'movies' => array_keys($movieGroups),
            'series' => array_keys($seriesGroups),
        ],
        'counts' => ['channels' => count($channels), 'movies' => count($movies), 'series' => count($series)],
    ];
}

function parse_extinf_line(string $line): array
{
    $rest = trim(substr($line, 8));
    $attrs = [];
    if (preg_match_all('/([\w-]+)="([^"]*)"/', $rest, $m, PREG_SET_ORDER)) {
        foreach ($m as $match) $attrs[strtolower($match[1])] = $match[2];
    }
    $name = '';
    $pos = strrpos($rest, ',');
    if ($pos !== false) $name = trim(substr($rest, $pos + 1));
    return ['name' => $name, 'attrs' => $attrs];
}

function detect_content_type(string $haystack): string
{
    $hay = mb_strtolower($haystack);
    if (preg_match('/(filme|movie|\bvod\b|video_on_demand)/', $hay)) return 'movie';
    if (preg_match('/(serie|séries|series|episod|anime|\bs\d{1,2}e\d{1,3}\b)/', $hay)) return 'series';
    return 'live';
}

function parse_episode_title(string $name): array
{
    if (preg_match('/^(.*?)\s*[-–]\s*S?(\d{1,2})[xE](\d{1,3})\b/i', $name, $m)) {
        return ['series' => trim($m[1]), 'season' => (int) $m[2], 'episode' => (int) $m[3]];
    }
    if (preg_match('/\bS(\d{1,2})E(\d{1,3})\b/i', $name, $m)) {
        return ['series' => trim(preg_replace('/\bS\d{1,2}E\d{1,3}\b.*$/i', '', $name)), 'season' => (int) $m[1], 'episode' => (int) $m[2]];
    }
    return ['series' => $name, 'season' => 0, 'episode' => 0];
}
