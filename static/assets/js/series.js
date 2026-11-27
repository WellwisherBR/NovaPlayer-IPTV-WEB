/* Séries locais: catálogo, temporadas, episódios e progresso. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => Nova.escapeHtml(s);
  let all = [], view = [], current = null, currentSeries = null, lastSave = 0, pendingFullscreen = false;
  const detailModal = Nova.modal($('series-detail-modal'));
  const playModal = Nova.modal($('series-play-modal'));
  const player = NovaPlayer.create($('series-video'), {
    engine: NovaStore.setting('engine', 'hlsjs'),
    onEnded: () => {
      if (!current || !currentSeries) return;
      NovaStore.saveProgress('episode', current.id, {
        title: (current.seriesName || currentSeries.name) + ' - ' + current.name,
        poster: current.poster || currentSeries.poster || '',
        position: 0, duration: current.duration || 0, completed: true
      });
      const eps = currentSeries.episodes || [];
      const idx = eps.findIndex(e => String(e.id) === String(current.id));
      const next = eps[idx + 1];
      if (next) {
        Nova.toast('Próximo episódio: ' + next.name);
        play(next, current.seriesName || currentSeries.name);
      } else {
        Nova.toast('Você chegou ao último episódio desta série.');
      }
    },
    onTime: info => {
      if (!current || !info.duration || Date.now() - lastSave < 6000) return;
      lastSave = Date.now();
      NovaStore.saveProgress('episode', current.id, {
        title: current.seriesName + ' - ' + current.name, poster: current.poster || '',
        position: Math.floor(info.current), duration: Math.floor(info.duration),
        completed: info.current / info.duration > 0.95
      });
    },
    onError: msg => { $('series-play-message').style.display = 'grid'; Nova.toast(msg, 'error'); }
  });

  function card(s) {
    const img = s.poster ? '<img src="' + esc(s.poster) + '" alt="' + esc(s.name) + '" loading="lazy" onerror="this.remove()">' : '<div class="poster-fallback">' + esc(s.name.charAt(0)) + '</div>';
    return '<div class="poster-card" data-id="' + esc(s.id) + '" data-focusable tabindex="0">' + img +
      '<button class="poster-fav' + (NovaStore.isFavorite('series', s.id) ? ' on' : '') + '" data-fav="' + esc(s.id) + '">' + Nova.icon('heart') + '</button>' +
      '<div class="poster-label"><div class="poster-name">' + esc(s.name) + '</div><div class="poster-sub">' + esc([s.year, s.genre].filter(Boolean).join(' • ') || s.source) + '</div></div></div>';
  }

  function render() {
    const q = $('series-search').value.trim().toLowerCase(), cat = $('series-category').value;
    view = all.filter(s => {
      if (cat !== 'all' && s.group !== cat) return false;
      return !q || s.name.toLowerCase().includes(q);
    });
    $('series-grid').innerHTML = view.length ? view.map(card).join('') :
      '<div class="empty-state">' + Nova.icon('clapper') + '<strong>Nenhuma série encontrada</strong><span>Verifique a sincronização ou adicione uma playlist com séries.</span>' +
      '<button class="btn-ghost btn-sm" id="series-open-playlists">Gerenciar playlists</button></div>';
    const openPl = $('series-open-playlists');
    if (openPl) openPl.addEventListener('click', () => NovaPlaylists.open());
    $('series-grid').querySelectorAll('[data-id]').forEach(el => el.addEventListener('click', ev => {
      if (ev.target.closest('[data-fav]')) return;
      const s = view.find(x => String(x.id) === el.dataset.id);
      if (s) openDetail(s);
    }));
    $('series-grid').querySelectorAll('[data-fav]').forEach(btn => btn.addEventListener('click', ev => {
      ev.stopPropagation(); btn.classList.toggle('on', NovaStore.toggleFavorite('series', btn.dataset.fav));
    }));
  }

  function load() {
    all = NovaStore.all().series;
    const groups = [...new Set(all.map(s => s.group).filter(Boolean))];
    const sel = $('series-category'), prev = sel.value;
    sel.innerHTML = '<option value="all">Todas as séries</option>' + groups.map(g => '<option value="' + esc(g) + '">' + esc(g) + '</option>').join('');
    sel.value = groups.includes(prev) ? prev : 'all';
    render();
  }

  function episodeHtml(ep, seriesName) {
    const img = ep.poster ? '<div class="episode-thumb"><img src="' + esc(ep.poster) + '" alt="" loading="lazy"></div>' : '<div class="episode-thumb"></div>';
    const pr = NovaStore.progress('episode', ep.id);
    const pct = pr && pr.duration ? Math.min(100, Math.round(pr.position / pr.duration * 100)) : 0;
    return '<div class="episode-row" data-episode="' + esc(ep.id) + '" data-focusable tabindex="0">' + img +
      '<div style="min-width:0;flex:1"><div class="episode-name">' + esc(ep.name) + '</div>' +
      '<div class="episode-num">T' + esc(ep.season) + ' • Episódio ' + esc(ep.episode) + (pr && pr.completed ? ' • Assistido' : '') + '</div>' +
      '<div class="episode-desc">' + esc(ep.description || '') + '</div>' +
      (pct > 0 ? '<div class="progress-bar" style="max-width:220px"><span style="width:' + pct + '%"></span></div>' : '') +
      '</div>' + Nova.icon('play') + '</div>';
  }

  async function openDetail(s) {
    current = s;
    currentSeries = s;
    if ((!s.episodes || !s.episodes.length) && s.providerId) {
      Nova.loading.show('Carregando episódios');
      Nova.loading.step(s.name);
      try { s = await NovaStore.loadEpisodes(s); }
      catch (e) { Nova.toast('Não foi possível carregar os episódios: ' + e.message, 'error'); }
      Nova.loading.hide();
    }
    const img = s.poster ? '<img src="' + esc(s.poster) + '" alt="" loading="lazy">' : '<div class="poster-fallback">' + esc(s.name.charAt(0)) + '</div>';
    const seasons = [...new Set((s.episodes || []).map(e => e.season))].sort((a, b) => a - b);
    $('series-detail-content').innerHTML = '<div class="detail-hero"><div class="detail-poster">' + img + '</div><div>' +
      '<h2>' + esc(s.name) + '</h2><div class="detail-meta"><span>' + esc(s.year || '—') + '</span><span>' + esc(s.genre || '—') + '</span><span>' + esc(s.rating || 'L') + '</span><span>' + esc(s.source) + '</span></div>' +
      '<p class="detail-desc">' + esc(s.description || 'Sinopse não fornecida pelo provedor.') + '</p>' +
      '<div class="detail-actions"><button class="btn-ghost" id="btn-fav-detail">' + Nova.icon('heart') + ' ' + (NovaStore.isFavorite('series', s.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos') + '</button></div>' +
      '<div class="season-tabs">' + seasons.map((n, i) => '<button class="chip' + (i === 0 ? ' active' : '') + '" data-season="' + n + '">Temporada ' + n + '</button>').join('') + '</div>' +
      '<div class="episode-list" id="episode-list"></div></div></div>';
    const renderSeason = n => {
      const eps = (s.episodes || []).filter(e => e.season === n);
      $('episode-list').innerHTML = eps.length ? eps.map(e => episodeHtml(e, s.name)).join('') : '<div class="text-secondary small">Sem episódios.</div>';
      $('episode-list').querySelectorAll('[data-episode]').forEach(el => el.addEventListener('click', () => {
        const ep = eps.find(e => String(e.id) === el.dataset.episode);
        if (ep) { pendingFullscreen = true; playModal.show(); player.enterFullscreen(); play(ep, s.name); }
      }));
    };
    $('series-detail-content').querySelectorAll('[data-season]').forEach(b => b.addEventListener('click', () => {
      $('series-detail-content').querySelectorAll('[data-season]').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); renderSeason(Number(b.dataset.season));
    }));
    if (seasons.length) {
      renderSeason(seasons[0]);
    } else {
      $('episode-list').innerHTML = '<div class="empty-state" style="min-height:150px">' + Nova.icon('warn') +
        '<strong>Nenhum episódio carregado</strong><span>O provedor pode não ter fornecido episódios para esta série.</span>' +
        (s.providerId ? '<button class="btn-ghost btn-sm" id="retry-episodes">Tentar carregar novamente</button>' : '') + '</div>';
      const rb = $('retry-episodes');
      if (rb) rb.addEventListener('click', async () => {
        Nova.loading.show('Carregando episódios'); Nova.loading.step(s.name);
        try {
          const updated = await NovaStore.loadEpisodes(s);
          Nova.loading.hide();
          openDetail(updated);
        } catch (e) {
          Nova.loading.hide();
          Nova.toast('Falha ao carregar episódios: ' + e.message, 'error');
        }
      });
    }
    $('btn-fav-detail').addEventListener('click', () => {
      const on = NovaStore.toggleFavorite('series', s.id);
      $('btn-fav-detail').innerHTML = Nova.icon('heart') + ' ' + (on ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
    });
    detailModal.show();
  }

  async function play(ep, seriesName) {
    current = Object.assign({ seriesName }, ep);
    $('series-play-title').textContent = seriesName + ' - ' + ep.name;
    $('series-play-message').style.display = 'none';
    try {
      await player.playDirect(ep.url, ep);
      const pr = NovaStore.progress('episode', ep.id);
      if (pr && pr.position > 0) player.video().currentTime = pr.position;
    } catch (e) {
      $('series-play-message').style.display = 'grid';
      $('series-play-message').firstElementChild.textContent = e.message;
      Nova.toast(e.message, 'error');
    }
  }

  $('series-play-modal').addEventListener('shown.bs.modal', () => {
    if (pendingFullscreen) { pendingFullscreen = false; player.enterFullscreen(); }
  });
  $('series-play-close').addEventListener('click', () => { player.exitFullscreen(); player.pause(); });
  $('series-play-modal').addEventListener('hidden.bs.modal', () => { player.exitFullscreen(); player.pause(); });
  let t = null;
  $('series-search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 250); });
  $('series-category').addEventListener('change', render);
  Nova.onBack(() => {
    const open = el => el && (el.classList.contains('show') || getComputedStyle(el).display === 'block');
    if (open($('series-play-modal'))) { playModal.hide(); return true; }
    if (open($('series-detail-modal'))) { detailModal.hide(); return true; }
    return false;
  }, 'series');

  window.addEventListener('load', () => NovaStore.ready.then(load).catch(load));
  window.addEventListener('novaplay:playlists-changed', load);
})();
