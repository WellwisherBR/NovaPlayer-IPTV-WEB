<?php
/**
 * Configurações centrais — modo local (sem usuários e sem banco de dados).
 * O PHP atua apenas como proxy para buscar/parsear M3U e APIs Xtream.
 */
declare(strict_types=1);

define('APP_NAME', getenv('APP_NAME') ?: 'NovaPlay IPTV');
define('APP_VERSION', '1.0.0');
// Altere este valor após mudanças em CSS/JS para forçar o navegador a recarregar.
define('APP_BUILD', '20261127o');
define('APP_TAGLINE', 'Sua televisão, do seu jeito');

define('BASE_PATH', dirname(__DIR__));
define('STORAGE_PATH', BASE_PATH . DIRECTORY_SEPARATOR . 'storage');

date_default_timezone_set(getenv('APP_TIMEZONE') ?: 'America/Sao_Paulo');

// URL base auto detectada, considerando os subdiretórios da aplicação.
$__scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
    ? 'https' : 'http';
$__host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$__dir  = trim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
$__parts = $__dir === '' ? [] : explode('/', $__dir);
$__skip = ['app', 'api', 'proxy'];
while ($__parts && in_array(end($__parts), $__skip, true)) {
    array_pop($__parts);
}
$__root = $__parts ? '/' . implode('/', $__parts) : '';
define('APP_URL', $__scheme . '://' . $__host . $__root);
unset($__scheme, $__host, $__dir, $__parts, $__skip, $__root);

define('HTTP_TIMEOUT', 20);
define('PLAYLIST_MAX_BYTES', 30 * 1024 * 1024);
