<?php
/** Aplicação em página única (SPA): Home, Live TV, Movies e Series. */
declare(strict_types=1);
require_once __DIR__ . '/includes/bootstrap.php';
$pageTitle = APP_NAME;
$pageId = 'home';
$pageScripts = ['home.js', 'live.js', 'movies.js', 'series.js'];
require_once __DIR__ . '/includes/header.php';
?>

<main class="page-main">
  <!-- ========== HOME ========== -->
  <section class="view view-home active" id="view-home">
    <div class="home-shell">
      <div class="home-intro">
        <h1>Bem-vindo</h1>
        <span>Adicione suas playlists e navegue com as setas do controle remoto</span>
        <button class="btn-brand btn-sm ms-auto" id="home-add-playlist" data-focusable><?= NovaIcon('plus') ?> Adicionar playlist</button>
      </div>
      <div class="home-status" id="home-status"></div>
      <nav class="home-grid" aria-label="Menu principal">
        <a class="menu-card card-live" href="#live" data-view="live" data-focusable data-card="live">
          <div class="card-top"><span class="card-icon"><svg class="ico"><use href="#i-tv"/></svg></span><span class="card-count" id="count-live">0 canais</span></div>
          <div class="card-body"><span class="card-title">LIVE TV</span><span class="card-sub">Canais ao vivo, esportes e notícias em tempo real</span></div>
          <svg class="ico card-arrow"><use href="#i-back"/></svg>
        </a>
        <div class="home-right">
          <a class="menu-card card-movies" href="#movies" data-view="movies" data-focusable data-card="movies">
            <div class="card-top"><span class="card-icon"><svg class="ico"><use href="#i-play"/></svg></span><span class="card-count" id="count-movies">0 filmes</span></div>
            <div class="card-body"><span class="card-title">MOVIES</span><span class="card-sub">Filmes sob demanda, quando você quiser</span></div>
            <svg class="ico card-arrow"><use href="#i-back"/></svg>
          </a>
          <a class="menu-card card-series" href="#series" data-view="series" data-focusable data-card="series">
            <div class="card-top"><span class="card-icon"><svg class="ico"><use href="#i-clapper"/></svg></span><span class="card-count" id="count-series">0 séries</span></div>
            <div class="card-body"><span class="card-title">SERIES</span><span class="card-sub">Temporadas e episódios para maratonar</span></div>
            <svg class="ico card-arrow"><use href="#i-back"/></svg>
          </a>
        </div>
      </nav>
    </div>
  </section>

  <!-- ========== LIVE TV ========== -->
  <section class="view view-live" id="view-live">
    <div class="section-head">
      <div><h1 class="section-title">Live TV</h1><p class="section-sub">Canais das suas playlists salvas neste dispositivo</p></div>
      <input class="input-dark" id="channel-search" type="search" placeholder="Buscar canal..." data-nav-ignore>
    </div>
    <div class="live-layout">
      <aside class="panel live-sidebar">
        <div class="panel-head"><h2>Canais</h2><span class="pill" id="channel-total">0</span></div>
        <div class="chip-row" id="category-chips"></div>
        <div class="channel-list scroll-y" id="channel-list"></div>
      </aside>
      <section class="live-main">
        <div class="player-wrap">
          <video id="live-video" controls playsinline preload="none" tabindex="0" aria-label="Player de canal ao vivo"></video>
          <div class="player-overlay">
            <div class="top"><span class="player-badge live">● AO VIVO</span><span class="player-title" id="player-title">Selecione um canal</span><span class="player-badge" id="player-clock">--:--</span></div>
            <div class="bottom"><div class="player-ctrl">
              <button id="btn-play" data-focusable><?= NovaIcon('play') ?></button>
              <button id="btn-mute" data-focusable><?= NovaIcon('volume') ?></button>
              <button id="btn-fs" data-focusable><?= NovaIcon('expand') ?></button>
              <select id="quality-select" class="form-select dark" style="width:auto;padding:.35rem .6rem;font-size:.75rem" data-focusable><option value="-1">Automático</option></select>
            </div></div>
          </div>
          <div class="player-message" id="player-message"><div><svg class="ico"><use href="#i-tv"/></svg><div>Adicione uma playlist e selecione um canal para assistir.</div></div></div>
        </div>
        <div class="panel epg-panel">
          <div class="panel-head"><h3>Programação</h3><span class="pill" id="epg-channel-name">—</span></div>
          <div class="epg-list scroll-y" id="epg-list"><div class="text-secondary small">A programação aparece quando o provedor fornece EPG.</div></div>
          <div class="next-info" id="next-info">Próximo programa: —</div>
        </div>
      </section>
    </div>
  </section>

  <!-- ========== MOVIES ========== -->
  <section class="view view-movies" id="view-movies">
    <div class="section-head"><div><h1 class="section-title">Filmes</h1><p class="section-sub">Catálogo salvo neste dispositivo</p></div></div>
    <div class="catalog-toolbar">
      <input class="input-dark" id="movie-search" type="search" placeholder="Buscar filme ou gênero..." data-nav-ignore>
      <select class="form-select dark" id="movie-category" data-focusable><option value="all">Todos os filmes</option></select>
    </div>
    <div class="catalog-grid" id="movie-grid"></div>
  </section>

  <!-- ========== SERIES ========== -->
  <section class="view view-series" id="view-series">
    <div class="section-head"><div><h1 class="section-title">Séries</h1><p class="section-sub">Temporadas e episódios das suas playlists</p></div></div>
    <div class="catalog-toolbar">
      <input class="input-dark" id="series-search" type="search" placeholder="Buscar série..." data-nav-ignore>
      <select class="form-select dark" id="series-category" data-focusable><option value="all">Todas as séries</option></select>
    </div>
    <div class="catalog-grid" id="series-grid"></div>
  </section>
</main>

<!-- Navegação inferior (controle remoto / touch) -->
<nav class="spa-nav" aria-label="Navegação principal">
  <button data-view="home" class="active" data-focusable><?= NovaIcon('check') ?> Início</button>
  <button data-view="live" data-focusable><?= NovaIcon('tv') ?> Live TV</button>
  <button data-view="movies" data-focusable><?= NovaIcon('play') ?> Filmes</button>
  <button data-view="series" data-focusable><?= NovaIcon('clapper') ?> Séries</button>
  <button data-action="playlists" data-focusable><?= NovaIcon('list') ?> Playlists</button>
</nav>

<!-- Detalhes / player de filmes -->
<div class="modal fade" id="detail-modal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-xl modal-dialog-centered"><div class="modal-content modal-dark">
    <div class="modal-header border-secondary"><h5 class="modal-title">Detalhes do filme</h5><button class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>
    <div class="modal-body p-0" id="detail-content"></div>
  </div></div>
</div>
<div class="modal fade" id="play-modal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-xl modal-dialog-centered"><div class="modal-content modal-dark">
    <div class="modal-header border-secondary"><h5 class="modal-title" id="play-title">Reproduzindo</h5><button class="btn-close btn-close-white" id="play-close" data-bs-dismiss="modal"></button></div>
    <div class="modal-body p-0">
      <div class="player-wrap" style="border:0;border-radius:0">
        <video id="movie-video" controls playsinline preload="none" tabindex="0" aria-label="Player de filme"></video>
        <div class="player-message" id="play-message"><div>Erro ao carregar o vídeo.</div></div>
      </div>
    </div>
  </div></div>
</div>

<!-- Detalhes / player de séries -->
<div class="modal fade" id="series-detail-modal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-xl modal-dialog-centered"><div class="modal-content modal-dark">
    <div class="modal-header border-secondary"><h5 class="modal-title">Detalhes da série</h5><button class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>
    <div class="modal-body p-0" id="series-detail-content"></div>
  </div></div>
</div>
<div class="modal fade" id="series-play-modal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-xl modal-dialog-centered"><div class="modal-content modal-dark">
    <div class="modal-header border-secondary"><h5 class="modal-title" id="series-play-title">Reproduzindo</h5><button class="btn-close btn-close-white" id="series-play-close" data-bs-dismiss="modal"></button></div>
    <div class="modal-body p-0">
      <div class="player-wrap" style="border:0;border-radius:0">
        <video id="series-video" controls playsinline preload="none" tabindex="0" aria-label="Player de episódio"></video>
        <div class="player-message" id="series-play-message"><div>Erro ao carregar o vídeo.</div></div>
      </div>
    </div>
  </div></div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
