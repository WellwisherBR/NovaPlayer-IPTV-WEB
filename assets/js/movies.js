/* Catálogo de filmes local: filtros, detalhes, favoritos e progresso. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => Nova.escapeHtml(s);
  let all = [], view = [], current = null, lastSave = 0, pendingFullscreen = false;
  const detailModal = Nova.modal($('detail-modal'));
  const playModal = Nova.modal($('play-modal'));
  const player = NovaPlayer.create($('movie-video'), {
    engine: NovaStore.setting('engine', 'hlsjs'),
    onTime: info => {
      if (!current || !info.duration || Date.now() - lastSave < 6000) return;
      lastSave = Date.now();
      NovaStore.saveProgress('movie', current.id, {
        title: current.name, poster: current.poster || '',
        position: Math.floor(info.current), duration: Math.floor(info.duration),
        completed: info.current / info.duration > 0.95
      });
    },
    onError: msg => { $('play-message').style.display = 'grid'; Nova.toast(msg, 'error'); }
  });

  function poster(m) {
    const img = m.poster ? '<img src="' + esc(m.poster) + '" alt="' + esc(m.name) + '" loading="lazy" onerror="this.remove()">' : '<div class="poster-fallback">' + esc((m.name || '?').charAt(0)) + '</div>';
    const pr = NovaStore.progress('movie', m.id);
    const pct = pr && pr.duration ? Math.min(100, Math.round(pr.position / pr.duration * 100)) : 0;
    return '<div class="poster-card" data-id="' + esc(m.id) + '" data-focusable tabindex="0">' + img +
      '<button class="poster-fav' + (NovaStore.isFavorite('movie', m.id) ? ' on' : '') + '" data-fav="' + esc(m.id) + '">' + Nova.icon('heart') + '</button>' +
      '<div class="poster-label"><div class="poster-name">' + esc(m.name) + '</div>' +
      '<div class="poster-sub">' + esc([m.year, m.genre].filter(Boolean).join(' • ') || m.source) + '</div>' +
      (pct > 0 ? '<div class="progress-bar"><span style="width:' + pct + '%"></span></div>' : '') + '</div></div>';
  }

  function render() {
    const q = $('movie-search').value.trim().toLowerCase();
    const cat = $('movie-category').value;
    view = all.filter(m => {
      if (cat !== 'all' && m.group !== cat) return false;
      return !q || m.name.toLowerCase().includes(q) || (m.genre || '').toLowerCase().includes(q);
    });
    $('movie-grid').innerHTML = view.length ? view.map(poster).join('') :
      '<div class="empty-state">' + Nova.icon('play') + '<strong>Nenhum filme encontrado</strong><span>Verifique a sincronização ou adicione uma playlist com filmes.</span>' +
      '<button class="btn-ghost btn-sm" id="movies-open-playlists">Gerenciar playlists</button></div>';
    const openPl = $('movies-open-playlists');
    if (openPl) openPl.addEventListener('click', () => NovaPlaylists.open());
    $('movie-grid').querySelectorAll('[data-id]').forEach(el => el.addEventListener('click', ev => {
      if (ev.target.closest('[data-fav]')) return;
      const m = view.find(x => String(x.id) === el.dataset.id);
      if (m) openDetail(m);
    }));
    $('movie-grid').querySelectorAll('[data-fav]').forEach(btn => btn.addEventListener('click', ev => {
      ev.stopPropagation(); btn.classList.toggle('on', NovaStore.toggleFavorite('movie', btn.dataset.fav));
    }));
  }

  function load() {
    all = NovaStore.all().movies;
    const groups = [...new Set(all.map(m => m.group).filter(Boolean))];
    const sel = $('movie-category');
    const prev = sel.value;
    sel.innerHTML = '<option value="all">Todos os filmes</option>' + groups.map(g => '<option value="' + esc(g) + '">' + esc(g) + '</option>').join('');
    sel.value = groups.includes(prev) ? prev : 'all';
    render();
  }

  function openDetail(m) {
    current = m;
    const img = m.poster ? '<img src="' + esc(m.poster) + '" alt="" loading="lazy">' : '<div class="poster-fallback">' + esc(m.name.charAt(0)) + '</div>';
    const pr = NovaStore.progress('movie', m.id);
    $('detail-content').innerHTML = '<div class="detail-hero"><div class="detail-poster">' + img + '</div><div>' +
      '<h2>' + esc(m.name) + '</h2><div class="detail-meta"><span>' + esc(m.year || '—') + '</span><span>' + esc(m.genre || '—') + '</span><span>' + esc(m.rating || 'L') + '</span><span>' + esc(m.source) + '</span></div>' +
      '<p class="detail-desc">' + esc(m.description || 'Sinopse não fornecida pelo provedor.') + '</p>' +
      '<div class="detail-actions"><button class="btn-brand" id="btn-watch">' + Nova.icon('play') + ' ASSISTIR AGORA</button>' +
      '<button class="btn-ghost" id="btn-fav-detail">' + Nova.icon('heart') + ' ' + (NovaStore.isFavorite('movie', m.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos') + '</button>' +
      (pr && pr.position > 0 ? '<button class="btn-ghost" id="btn-resume">Continuar de ' + Nova.formatTime(pr.position) + '</button>' : '') + '</div></div></div>';
    $('btn-watch').addEventListener('click', () => { pendingFullscreen = true; playModal.show(); player.enterFullscreen(); play(m, false); });
    const r = $('btn-resume'); if (r) r.addEventListener('click', () => { pendingFullscreen = true; playModal.show(); player.enterFullscreen(); play(m, true); });
    $('btn-fav-detail').addEventListener('click', () => {
      const on = NovaStore.toggleFavorite('movie', m.id);
      $('btn-fav-detail').innerHTML = Nova.icon('heart') + ' ' + (on ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
    });
    detailModal.show();
  }

  async function play(m, resume) {
    current = m;
    $('play-title').textContent = m.name;
    $('play-message').style.display = 'none';
    try {
      await player.playDirect(m.url, m);
      if (resume) {
        const pr = NovaStore.progress('movie', m.id);
        if (pr && pr.position > 0) player.video().currentTime = pr.position;
      }
    } catch (e) {
      $('play-message').style.display = 'grid';
      $('play-message').firstElementChild.textContent = e.message;
      Nova.toast(e.message, 'error');
    }
  }

  $('play-modal').addEventListener('shown.bs.modal', () => {
    if (pendingFullscreen) { pendingFullscreen = false; player.enterFullscreen(); }
  });
  $('play-close').addEventListener('click', () => { player.exitFullscreen(); player.pause(); });
  $('play-modal').addEventListener('hidden.bs.modal', () => { player.exitFullscreen(); player.pause(); });
  let t = null;
  $('movie-search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 250); });
  $('movie-category').addEventListener('change', render);
  Nova.onBack(() => {
    const open = el => el && (el.classList.contains('show') || getComputedStyle(el).display === 'block');
    if (open($('play-modal'))) { playModal.hide(); return true; }
    if (open($('detail-modal'))) { detailModal.hide(); return true; }
    return false;
  }, 'movies');

  window.addEventListener('load', () => NovaStore.ready.then(load).catch(load));
  window.addEventListener('novaplay:playlists-changed', load);
})();
