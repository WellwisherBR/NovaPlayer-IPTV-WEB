<?php
/** Utilitários do modo local: escape, URLs, HTTP seguro e respostas JSON. */
declare(strict_types=1);

function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Ícone SVG inline a partir do sprite do cabeçalho. */
function NovaIcon(string $name): string
{
    return '<svg class="ico"><use href="#i-' . e(preg_replace('/[^a-z0-9-]/i', '', $name)) . '"/></svg>';
}

function asset(string $path): string
{
    return APP_URL . '/assets/' . ltrim($path, '/');
}

function app_url(string $path = ''): string
{
    return APP_URL . '/' . ltrim($path, '/');
}

function redirect(string $path): never
{
    header('Location: ' . (str_starts_with($path, 'http') ? $path : app_url($path)));
    exit;
}

function json_ok(array $data = [], int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $status = 400): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_from_request(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return $_POST;
    $data = json_decode($raw, true);
    return is_array($data) ? $data : $_POST;
}

function clean_string(mixed $value, int $maxLen = 500): string
{
    $value = is_scalar($value) ? (string) $value : '';
    return mb_substr(trim(strip_tags($value)), 0, $maxLen);
}

/** Valida URL remota e bloqueia endereços privados (proteção SSRF). */
function safe_remote_url(string $url): string
{
    $parts = parse_url(trim($url));
    if (!$parts || !in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) || empty($parts['host'])) {
        throw new InvalidArgumentException('URL inválida. Use http:// ou https://.');
    }
    $host = $parts['host'];
    $ip = filter_var($host, FILTER_VALIDATE_IP) ? $host : gethostbyname($host);
    if (!filter_var($ip, FILTER_VALIDATE_IP)) {
        throw new InvalidArgumentException('Não foi possível resolver o host da URL.');
    }
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        throw new InvalidArgumentException('URLs internas/privadas não são permitidas.');
    }
    return $url;
}

/** Requisição HTTP via cURL com fallback para file_get_contents. */
function http_get(string $url, array $headers = [], int $timeout = HTTP_TIMEOUT): string
{
    $url = safe_remote_url($url);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 4,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_ENCODING => '',
            CURLOPT_USERAGENT => APP_NAME . '/' . APP_VERSION,
            CURLOPT_HTTPHEADER => $headers,
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        if ($body === false) throw new RuntimeException('Falha ao acessar a URL: ' . $error);
        if ($status >= 400) throw new RuntimeException('Servidor remoto respondeu HTTP ' . $status . '.');
        return (string) $body;
    }
    $ctx = stream_context_create([
        'http' => ['timeout' => $timeout, 'header' => implode("\r\n", $headers), 'follow_location' => 1],
        'ssl'  => ['verify_peer' => true, 'verify_peer_name' => true],
    ]);
    $body = @file_get_contents($url, false, $ctx);
    if ($body === false) throw new RuntimeException('Falha ao acessar a URL.');
    return (string) $body;
}
