<?php
/**
 * Proxy da API Xtream Codes: consulta o provedor no servidor e devolve
 * canais, filmes, séries e EPG em JSON para o navegador.
 */
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') json_error('Método não permitido.', 405);
$data = json_from_request();
$base = rtrim(clean_string($data['url'] ?? '', 1000), '/');
// Aceita tanto a URL base quanto a URL completa de player_api.php.
if (stripos($base, 'player_api.php') !== false) {
    $parts = parse_url($base);
    if ($parts && !empty($parts['scheme']) && !empty($parts['host'])) {
        $path = rtrim(str_replace('\\', '/', $parts['path'] ?? ''), '/');
        $path = rtrim(str_replace('/player_api.php', '', $path), '/');
        $base = $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '') . $path;
    }
}
$user = clean_string($data['username'] ?? '', 120);
$pass = clean_string($data['password'] ?? '', 120);
$action = clean_string($data['action'] ?? 'all', 30);

if ($base === '' || $user === '' || $pass === '') json_error('Informe URL do servidor, usuário e senha.', 400);
try { safe_remote_url($base); } catch (Throwable $e) { json_error($e->getMessage(), 400); }

$allowed = ['get_live_categories', 'get_live_streams', 'get_vod_categories', 'get_vod_streams',
            'get_series_categories', 'get_series', 'get_series_info', 'get_epg'];
if ($action !== 'all' && !in_array($action, $allowed, true)) json_error('Ação não permitida.', 400);

try {
    if ($action !== 'all') {
        $extra = [];
        if (!empty($data['id'])) $extra['id'] = $data['id'];
        if (!empty($data['series_id'])) $extra['series_id'] = $data['series_id'];
        if (!empty($data['stream_id'])) $extra['stream_id'] = $data['stream_id'];
        json_ok(xtream_request($base, $user, $pass, $action, $extra));
    }
    json_ok(xtream_all($base, $user, $pass));
} catch (Throwable $e) {
    json_error('Falha ao consultar o provedor: ' . $e->getMessage(), 422);
}

function xtream_request(string $base, string $user, string $pass, string $action, array $extra = []): array
{
    $query = http_build_query(array_merge([
        'username' => $user, 'password' => $pass, 'action' => $action,
    ], $extra));
    $body = http_get($base . '/player_api.php?' . $query, ['Accept' => 'application/json']);
    $json = json_decode($body, true);
    if (!is_array($json)) throw new RuntimeException('Resposta inválida da API (' . $action . ').');
    if (($json['user_info']['status'] ?? null) === 'Expired') throw new RuntimeException('Assinatura do provedor expirada.');
    return $json;
}

function stream_url(string $base, string $user, string $pass, string $type, string $id, string $ext = 'ts'): string
{
    return $base . '/' . $type . '/' . urlencode($user) . '/' . urlencode($pass) . '/' . rawurlencode($id) . '.' . $ext;
}

function xtream_all(string $base, string $user, string $pass): array
{
    $channels = []; $movies = []; $series = [];
    $liveCats = []; $movieCats = []; $seriesCats = [];

    foreach (xtream_request($base, $user, $pass, 'get_live_categories') as $c) {
        $liveCats[(string) ($c['category_id'] ?? '')] = (string) ($c['category_name'] ?? 'Outros');
    }
    foreach (xtream_request($base, $user, $pass, 'get_live_streams') as $i => $s) {
        $id = (string) ($s['stream_id'] ?? '');
        if ($id === '') continue;
        $channels[] = [
            'id' => 'ch-' . $id,
            'name' => clean_string($s['name'] ?? 'Canal', 180),
            'logo' => (string) ($s['stream_icon'] ?? ''),
            'group' => $liveCats[(string) ($s['category_id'] ?? '')] ?? 'Outros',
            'url' => !empty($s['direct_source']) ? $s['direct_source'] : stream_url($base, $user, $pass, 'live', $id, 'm3u8'),
            'fallbackUrl' => !empty($s['direct_source']) ? '' : stream_url($base, $user, $pass, 'live', $id, 'ts'),
            'number' => $i + 1,
            'catchup' => !empty($s['tv_archive']),
            'epgId' => (string) ($s['epg_channel_id'] ?? ''),
            'streamId' => $id,
        ];
    }

    foreach (xtream_request($base, $user, $pass, 'get_vod_categories') as $c) {
        $movieCats[(string) ($c['category_id'] ?? '')] = (string) ($c['category_name'] ?? 'Outros');
    }
    foreach (xtream_request($base, $user, $pass, 'get_vod_streams') as $m) {
        $id = (string) ($m['stream_id'] ?? '');
        if ($id === '') continue;
        $movies[] = [
            'id' => 'movie-' . $id,
            'name' => clean_string($m['name'] ?? 'Filme', 180),
            'poster' => (string) ($m['stream_icon'] ?? ''),
            'group' => $movieCats[(string) ($m['category_id'] ?? '')] ?? 'Outros',
            'url' => !empty($m['direct_source']) ? $m['direct_source'] : stream_url($base, $user, $pass, 'movie', $id, (string) ($m['container'] ?? 'mp4')),
            'altUrl' => (empty($m['direct_source']) && strtolower((string) ($m['container'] ?? 'mp4')) !== 'mp4')
                ? stream_url($base, $user, $pass, 'movie', $id, 'mp4') : '',
            'year' => is_numeric($m['year'] ?? null) ? (int) $m['year'] : null,
            'genre' => clean_string($m['genre'] ?? '', 200),
            'rating' => clean_string($m['rating'] ?? '', 30),
            'description' => clean_string($m['description'] ?? '', 2000),
        ];
    }

    foreach (xtream_request($base, $user, $pass, 'get_series_categories') as $c) {
        $seriesCats[(string) ($c['category_id'] ?? '')] = (string) ($c['category_name'] ?? 'Outros');
    }
    // A lista de séries vem rápido; os episódios são buscados sob demanda
    // quando o usuário abre a série (evita timeouts na sincronização).
    foreach (xtream_request($base, $user, $pass, 'get_series') as $s) {
        $sid = (string) ($s['series_id'] ?? '');
        if ($sid === '') continue;
        $series[] = [
            'id' => 'series-' . $sid,
            'providerId' => $sid,
            'name' => clean_string($s['name'] ?? 'Série', 180),
            'poster' => (string) ($s['cover'] ?? ''),
            'group' => $seriesCats[(string) ($s['category_id'] ?? '')] ?? 'Outros',
            'year' => is_numeric($s['year'] ?? null) ? (int) $s['year'] : null,
            'genre' => clean_string($s['genre'] ?? '', 200),
            'rating' => clean_string($s['rating'] ?? '', 30),
            'description' => clean_string($s['plot'] ?? '', 2000),
            'episodes' => [],
        ];
    }

    return [
        'channels' => $channels, 'movies' => $movies, 'series' => $series,
        'categories' => [
            'live' => array_values($liveCats),
            'movies' => array_values($movieCats),
            'series' => array_values($seriesCats),
        ],
        'counts' => ['channels' => count($channels), 'movies' => count($movies), 'series' => count($series)],
    ];
}
