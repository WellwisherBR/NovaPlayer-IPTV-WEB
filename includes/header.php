<?php
/** Cabeçalho compartilhado — modo local (sem login). */
declare(strict_types=1);
$pageTitle = $pageTitle ?? APP_NAME;
$pageId    = $pageId ?? 'home';
$pageScripts = $pageScripts ?? [];
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#020B19">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta name="description" content="Player IPTV local, com playlists salvas no dispositivo">
<title><?= e($pageTitle) ?> · <?= e(APP_NAME) ?></title>
<link rel="manifest" href="<?= e(app_url('manifest.json')) ?>">
<link rel="icon" href="<?= e(asset('icons/icon.svg')) ?>" type="image/svg+xml">
<link href="<?= e(asset('css/vendor/bootstrap.min.css') . '?v=' . APP_BUILD) ?>" rel="stylesheet">
<link href="<?= e(asset('css/vendor/video-js.min.css') . '?v=' . APP_BUILD) ?>" rel="stylesheet">
<link href="<?= e(asset('css/base.css') . '?v=' . APP_BUILD) ?>" rel="stylesheet">
<link href="<?= e(asset('css/home.css') . '?v=' . APP_BUILD) ?>" rel="stylesheet">
<link href="<?= e(asset('css/app.css') . '?v=' . APP_BUILD) ?>" rel="stylesheet">
</head>
<body class="page-<?= e($pageId) ?>" data-page="<?= e($pageId) ?>">

<svg class="svg-sprite" aria-hidden="true" width="0" height="0" style="position:absolute">
  <symbol id="i-tv" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M7 2l5 4 5-4"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><path d="M7 4l14 8-14 8z" fill="currentColor" stroke="none"/></symbol>
  <symbol id="i-clapper" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M3 8l17-5 1 4-17 5zM8 7l2-3M14 5l2-3"/></symbol>
  <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></symbol>
  <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-9h.01"/></symbol>
  <symbol id="i-back" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>
  <symbol id="i-list" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
  <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 6v5h-5M4 18v-5h5"/><path d="M19 11a7 7 0 0 0-12-3L4 11m1 2a7 7 0 0 0 12 3l3-3"/></symbol>
  <symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-9 0l1 14h10l1-14"/></symbol>
  <symbol id="i-warn" viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3zM12 9v5m0 3h.01"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></symbol>
  <symbol id="i-volume" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zM17 9a4 4 0 0 1 0 6"/></symbol>
  <symbol id="i-expand" viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5m13 5h5v-5"/></symbol>
  <symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></symbol>
</svg>

<header class="app-header">
  <a class="brand" href="#home" data-focusable aria-label="Início">
    <img class="brand-logo" src="<?= e(asset('logos/logo.svg')) ?>" alt="">
    <span class="brand-text"><strong class="brand-name"><?= e(APP_NAME) ?></strong><span class="brand-tag"><?= e(APP_TAGLINE) ?></span></span>
    <span class="brand-version">v<?= e(APP_VERSION) ?></span>
  </a>
  <div class="header-tools">
    <div class="clock"><span class="clock-time" id="clock-time">--:--</span><span class="clock-date" id="clock-date">--</span></div>
    <button class="icon-btn" id="btn-back" data-focusable title="Voltar ao início (Esc)" style="display:none"><svg class="ico"><use href="#i-back"/></svg></button>
    <button class="icon-btn btn-playlists" id="btn-playlists" data-focusable title="Adicionar playlists"><svg class="ico"><use href="#i-list"/></svg></button>
    <button class="icon-btn" id="btn-about" data-focusable title="Sobre"><svg class="ico"><use href="#i-info"/></svg></button>
  </div>
</header>

<!-- Modal de playlists -->
<div class="modal fade" id="playlists-modal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-lg modal-dialog-centered"><div class="modal-content modal-dark">
    <div class="modal-header border-secondary">
      <h5 class="modal-title">Minhas playlists</h5><button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
    </div>
    <div class="modal-body">
      <ul class="nav nav-tabs mb-3" role="tablist">
        <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-m3u">M3U / M3U8</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-xtream">Xtream Codes / API</button></li>
      </ul>
      <div class="tab-content">
        <div class="tab-pane fade show active" id="tab-m3u">
          <form id="form-m3u" class="row g-3">
            <div class="col-12"><label class="form-label">Nome</label><input class="input-dark w-100" name="name" placeholder="Ex.: Canais da casa" required></div>
            <div class="col-12"><label class="form-label">Link M3U / M3U8</label><input class="input-dark w-100" name="url" placeholder="https://provedor.com/playlist.m3u8"></div>
            <div class="col-12"><label class="form-label">Ou arquivo M3U</label><input class="input-dark w-100" type="file" name="file" accept=".m3u,.m3u8,.txt"></div>
            <div class="col-12 text-secondary small">Informe o link ou selecione um arquivo. Os dados ficam salvos neste dispositivo.</div>
          </form>
        </div>
        <div class="tab-pane fade" id="tab-xtream">
          <form id="form-xtream" class="row g-3">
            <div class="col-md-6"><label class="form-label">Nome</label><input class="input-dark w-100" name="name" placeholder="Ex.: Provedor X" required></div>
            <div class="col-md-6"><label class="form-label">URL do servidor</label><input class="input-dark w-100" name="url" placeholder="http://host:8080" required></div>
            <div class="col-md-6"><label class="form-label">Usuário</label><input class="input-dark w-100" name="username" autocomplete="off" required></div>
            <div class="col-md-6"><label class="form-label">Senha</label><input class="input-dark w-100" type="password" name="password" autocomplete="off" required></div>
          </form>
        </div>
      </div>
      <div id="playlist-status" class="small mt-3"></div>
      <div id="playlist-list" class="mt-3"></div>
    </div>
    <div class="modal-footer border-secondary">
      <button class="btn-ghost" data-bs-dismiss="modal">Fechar</button>
      <button class="btn-brand" id="btn-add-playlist">Adicionar e importar</button>
    </div>
  </div></div>
</div>

<div class="modal fade" id="about-modal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered"><div class="modal-content modal-dark">
    <div class="modal-header border-secondary"><h5 class="modal-title">Sobre</h5><button class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>
    <div class="modal-body">
      <div class="d-flex align-items-center gap-3 mb-3"><img src="<?= e(asset('logos/logo.svg')) ?>" width="52" height="52" alt=""><div><strong><?= e(APP_NAME) ?></strong><div class="text-secondary small">Versão <?= e(APP_VERSION) ?></div></div></div>
      <p class="text-secondary small mb-2">Player IPTV local: playlists e preferências ficam salvas neste dispositivo. Não há contas nem servidor de usuários.</p>
      <p class="text-secondary small mb-0">Use o botão de playlists no topo para adicionar M3U/M3U8 ou Xtream Codes. Conteúdo reproduzido apenas de fontes que você possui autorização para usar.</p>
    </div>
    <div class="modal-footer border-secondary"><button class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">Fechar</button></div>
  </div></div>
</div>
<div id="toast-region" class="toast-region" aria-live="polite"></div>

<!-- Tela de carregamento -->
<div class="nova-loading" id="nova-loading" role="status" aria-live="polite">
  <div class="loading-box">
    <div class="loading-mark"><img src="<?= e(asset('logos/logo.svg')) ?>" alt=""></div>
    <h2 class="loading-title" id="loading-title">Carregando...</h2>
    <p class="loading-step" id="loading-step">Preparando...</p>
    <div class="loading-track"><span></span></div>
    <div class="loading-hint">Seus dados ficam salvos neste dispositivo</div>
  </div>
</div>
