<?php
/** Atalho para a visão Séries da aplicação única. */
declare(strict_types=1);
require_once __DIR__ . '/includes/bootstrap.php';
header('Location: ' . app_url('index.php#series'));
exit;
