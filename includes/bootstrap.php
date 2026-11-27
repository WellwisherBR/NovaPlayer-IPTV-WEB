<?php
/**
 * Bootstrap comum — modo local: somente funções utilitárias, sem sessão ou banco.
 */
declare(strict_types=1);

require_once dirname(__DIR__) . '/config/app.php';
require_once __DIR__ . '/functions.php';

if (!headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
}
