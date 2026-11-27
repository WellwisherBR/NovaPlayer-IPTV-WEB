<?php
/**
 * Proxy de stream HLS: busca o manifesto/segmentos no provedor e reescreve
 * os URLs relativos para passarem por este endpoint. Evita bloqueio CORS
 * quando o player roda em localhost ou em outro domínio.
 */
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';

$url = trim((string) ($_GET['url'] ?? ''));
if ($url === '') {
    http_response_code(400);
    exit('URL ausente.');
}
// Arquivos de vídeo grandes não devem ser baixados inteiros pelo PHP.
if (preg_match('/\.(mp4|m4v|mkv|avi|mov|webm)(\?|$)/i', $url)) {
    http_response_code(415);
    exit('Proxy não suporta arquivos de vídeo grandes; use o link direto.');
}
try {
    $url = safe_remote_url($url);
    $body = http_get($url, ['Accept' => '*/*'], 30);
} catch (Throwable $e) {
    http_response_code(502);
    exit('Falha ao buscar o stream: ' . $e->getMessage());
}

header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');

function proxy_url(string $absolute): string
{
    return APP_URL . '/api/proxy/hls.php?url=' . urlencode($absolute);
}

function resolve_url(string $base, string $relative): string
{
    if (preg_match('#^https?://#i', $relative)) return $relative;
    $p = parse_url($base);
    if (!$p || empty($p['scheme']) || empty($p['host'])) return $relative;
    $origin = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
    if (str_starts_with($relative, '/')) return $origin . $relative;
    $path = $p['path'] ?? '/';
    $dir = rtrim(str_replace('\\', '/', dirname($path)), '/');
    $full = $dir . '/' . $relative;
    $parts = [];
    foreach (explode('/', $full) as $seg) {
        if ($seg === '' || $seg === '.') continue;
        if ($seg === '..') { array_pop($parts); continue; }
        $parts[] = $seg;
    }
    return $origin . '/' . implode('/', $parts);
}

$isPlaylist = str_starts_with(ltrim($body), '#EXTM3U') || preg_match('/\.m3u8(\?|$)/i', $url);

if ($isPlaylist) {
    header('Content-Type: application/vnd.apple.mpegurl; charset=utf-8');
    $lines = preg_split('/\r\n|\r|\n/', $body) ?: [];
    foreach ($lines as $i => $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            // Reescreve atributos URI="..." de EXT-X-KEY / EXT-X-MAP / etc.
            $lines[$i] = preg_replace_callback('/URI="([^"]+)"/', static function ($m) use ($url) {
                return 'URI="' . proxy_url(resolve_url($url, $m[1])) . '"';
            }, $line);
            continue;
        }
        $lines[$i] = proxy_url(resolve_url($url, $trimmed));
    }
    echo implode("\n", $lines);
    exit;
}

$ext = strtolower((string) parse_url($url, PHP_URL_PATH));
if (str_ends_with($ext, '.ts')) header('Content-Type: video/mp2t');
elseif (str_ends_with($ext, '.m4s')) header('Content-Type: video/iso.segment');
elseif (str_ends_with($ext, '.mp4')) header('Content-Type: video/mp4');
elseif (str_ends_with($ext, '.aac')) header('Content-Type: audio/aac');
else header('Content-Type: application/octet-stream');
if (strlen($body) > 24 * 1024 * 1024) {
    http_response_code(413);
    exit('Segmento muito grande.');
}
echo $body;
