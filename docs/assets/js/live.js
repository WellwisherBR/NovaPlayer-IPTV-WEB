/* Live TV local: primeiro as pastas (categorias), depois os canais. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => Nova.escapeHtml(s);
  const state = { channels: [], view: [], selectedCat: null, search: '', current: null, playing: false };
  const player = NovaPlayer.create($('live-video'), {
    engine: NovaStore.setting('engine', 'hlsjs'),
    onError: msg => Nova.toast(msg, 'error')
  });

  function logo(ch) {
    const img = ch.logo ? '<img src="' + esc(ch.logo) + '" alt="" loading="lazy" onerror="this.remove()">' : '';
    return '<span class="channel-logo">' + img + (img ? '' : esc((ch.name || '?').charAt(0))) + '</span>';
  }

  function folders() {
    const map = new Map();
    state.channels.forEach(c => {
      const name = String(c.group || 'Outros').trim();
      map.set(name, (map.get(name) || 0) + 1);
    });
    const list = [];
    const favs = state.channels.filter(c => NovaStore.isFavorite('channel', c.id)).length;
    if (favs) list.push({ name: 'Favoritos', count: favs, favorite: true });
    [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([name, count]) => list.push({ name, count }));
    return list;
  }

  function renderFolders() {
    const items = folders();
    const chips = $('category-chips');
    chips.style.display = 'none';
    chips.innerHTML = '';
    $('channel-total').textContent = items.length + ' pastas';
    $('channel-list').innerHTML = items.length
      ? '<div class="folder-grid">' + items.map((f, i) =>
          '<button class="folder-card" data-folder="' + esc(f.name) + '" data-focusable tabindex="0">' +
          '<span class="folder-icon">' + Nova.icon(f.favorite ? 'heart' : 'list', 'ico') + '</span>' +
          '<span class="folder-name">' + esc(f.name) + '</span>' +
          '<span class="folder-count">' + f.count + (f.count === 1 ? ' canal' : ' canais') + '</span>' +
          '</button>').join('') + '</div>'
      : '<div class="empty-state">' + Nova.icon('tv') + '<strong>Nenhuma pasta encontrada</strong>' +
        '<span>Adicione e sincronize uma playlist para ver os canais.</span>' +
        '<button class="btn-ghost btn-sm" id="live-open-playlists">Gerenciar playlists</button></div>';
    const open = $('live-open-playlists');
    if (open) open.addEventListener('click', () => NovaPlaylists.open());
    $('channel-list').querySelectorAll('[data-folder]').forEach(btn => btn.addEventListener('click', () => {
      state.selectedCat = btn.dataset.folder;
      render();
    }));
  }

  function renderChannels() {
    const q = state.search.toLowerCase().trim();
    const cat = state.selectedCat;
    state.view = state.channels.filter(c => {
      if (!q && cat === 'Favoritos' && !NovaStore.isFavorite('channel', c.id)) return false;
      if (!q && cat && cat !== 'Favoritos' && String(c.group || 'Outros').trim() !== cat) return false;
      return !q || String(c.name || '').toLowerCase().includes(q) || String(c.group || '').toLowerCase().includes(q);
    });
    $('channel-total').textContent = state.view.length + ' canais';
    const chips = $('category-chips');
    chips.style.display = 'flex';
    chips.innerHTML = '<button class="chip" id="back-folders" data-focusable>‹ Pastas</button>' +
      '<span class="chip active" style="pointer-events:none">' + esc(q ? 'Busca: ' + q : (cat || 'Todos os canais')) + '</span>';
    $('back-folders').addEventListener('click', () => { state.selectedCat = null; state.search = ''; $('channel-search').value = ''; render(); });
    $('channel-list').innerHTML = state.view.length ? state.view.map(c =>
      '<div class="channel-item' + (state.current && state.current.id === c.id ? ' active' : '') + '" data-id="' + esc(c.id) + '" data-focusable role="button" tabindex="0">' +
      logo(c) + '<span class="channel-meta"><span class="channel-name">' + esc(c.name) + '</span>' +
      '<span class="channel-cat">' + esc(c.group || 'Sem categoria') + '</span></span>' +
      (c.catchup ? '<span class="badge-soft">catch up</span>' : '') +
      '<span class="channel-num">#' + esc(c.number || '-') + '</span>' +
      '<button type="button" class="fav-btn' + (NovaStore.isFavorite('channel', c.id) ? ' on' : '') + '" data-fav="' + esc(c.id) + '" aria-label="Favorito">' + Nova.icon('heart') + '</button></div>'
    ).join('') : '<div class="empty-state">' + Nova.icon('tv') + '<strong>Nenhum canal nesta pasta</strong><span>Tente outra categoria ou limpe a busca.</span>' +
      '<button class="btn-ghost btn-sm" id="back-folders-empty">Voltar às pastas</button></div>';
    const emptyBack = $('back-folders-empty');
    if (emptyBack) emptyBack.addEventListener('click', () => { state.selectedCat = null; state.search = ''; $('channel-search').value = ''; render(); });
    $('channel-list').querySelectorAll('[data-id]').forEach(el => el.addEventListener('click', ev => {
      if (ev.target.closest('[data-fav]')) return;
      const ch = state.view.find(c => String(c.id) === el.dataset.id);
      if (ch) select(ch);
    }));
    $('channel-list').querySelectorAll('[data-fav]').forEach(btn => btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const on = NovaStore.toggleFavorite('channel', btn.dataset.fav);
      btn.classList.toggle('on', on);
    }));
  }

  function render() {
    if (state.selectedCat === null && !state.search.trim()) renderFolders();
    else renderChannels();
  }

  function resetPlayer() {
    if (!state.playing) return false;
    state.playing = false;
    state.current = null;
    player.pause();
    try { player.video().removeAttribute('src'); player.video().load(); } catch (e) {}
    $('player-title').textContent = 'Selecione um canal';
    $('player-message').style.display = 'grid';
    $('player-message').lastElementChild.innerHTML = '<div><svg class="ico"><use href="#i-tv"/></svg><div>Selecione um canal para assistir.</div></div>';
    $('epg-channel-name').textContent = '—';
    $('epg-list').innerHTML = '<div class="text-secondary small">A programação aparece quando o provedor fornece EPG.</div>';
    $('next-info').textContent = 'Próximo programa: —';
    render();
    Nova.toast('Reprodução encerrada.');
    return true;
  }

  Nova.onBack(() => resetPlayer(), 'live');

  async function select(ch) {
    state.current = ch;
    state.playing = true;
    $('player-title').textContent = ch.name;
    $('player-message').style.display = 'none';
    try {
      try {
        await player.playDirect(ch.url, ch);
      } catch (first) {
        if (!ch.fallbackUrl) throw first;
        await player.playDirect(ch.fallbackUrl, ch);
      }
      const q = player.qualities();
      $('quality-select').innerHTML = '<option value="-1">Automático</option>' + q.map(x =>
        '<option value="' + x.index + '">' + esc(x.label) + '</option>').join('');
    } catch (e) {
      $('player-message').style.display = 'grid';
      $('player-message').lastElementChild.innerHTML = '<div><strong>Não foi possível reproduzir</strong><div class="small mt-1">' + esc(e.message) + '</div></div>';
      Nova.toast(e.message, 'error');
    }
    loadEpg(ch);
  }

  async function loadEpg(ch) {
    $('epg-channel-name').textContent = ch.name;
    const list = $('epg-list');
    const p = NovaStore.getPlaylist(ch.sourceId);
    if (!ch.streamId || !p || p.type !== 'xtream') {
      list.innerHTML = '<div class="text-secondary small">Este canal não forneceu EPG.</div>';
      $('next-info').textContent = 'Próximo programa: —';
      return;
    }
    try {
      const data = await NovaStore.api('xtream.php', { url: p.url, username: p.username, password: p.password, action: 'get_epg', stream_id: ch.streamId });
      const rows = Array.isArray(data) ? data : [];
      const now = Date.now() / 1000;
      let next = null;
      list.innerHTML = rows.length ? rows.map(r => {
        const start = Number(r.start_timestamp || 0), end = Number(r.end_timestamp || 0);
        if (start > now && !next) next = r;
        const fmt = t => new Date(t * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return '<div class="epg-row' + (start <= now && end > now ? ' current' : '') + '"><span class="epg-time">' + fmt(start) + ' – ' + fmt(end) + '</span>' +
          '<span class="epg-info"><span class="epg-title">' + esc(r.title || '') + (start <= now && end > now ? '<span class="epg-now">NO AR</span>' : '') + '</span>' +
          '<span class="epg-desc">' + esc(r.description || '') + '</span></span></div>';
      }).join('') : '<div class="text-secondary small">Sem programação disponível.</div>';
      $('next-info').textContent = next ? 'Próximo: ' + (next.title || '') : 'Próximo programa: —';
    } catch (e) {
      list.innerHTML = '<div class="text-secondary small">EPG indisponível.</div>';
    }
  }

  function switchChannel(delta) {
    if (!state.view.length) return;
    const i = state.view.findIndex(c => c.id === (state.current ? state.current.id : null));
    select(state.view[(i + delta + state.view.length) % state.view.length]);
  }

  window.addEventListener('load', () => {
    NovaStore.ready.then(() => {
      state.channels = NovaStore.all().channels;
      render();
    }).catch(() => { state.channels = []; render(); });
    $('channel-search').addEventListener('input', ev => { state.search = ev.target.value.trim(); render(); });
    $('btn-play').addEventListener('click', () => player.toggle());
    $('btn-mute').addEventListener('click', () => player.toggleMute());
    $('btn-fs').addEventListener('click', () => player.fullscreen());
    $('quality-select').addEventListener('change', ev => player.setQuality(Number(ev.target.value)));
    document.addEventListener('keydown', ev => {
      if (ev.target.matches('input,select,textarea')) return;
      const k = ev.key.toLowerCase();
      if (k === 'p') { player.toggle(); ev.preventDefault(); }
      else if (k === 'm') { player.toggleMute(); ev.preventDefault(); }
      else if (k === 'f') { player.fullscreen(); ev.preventDefault(); }
      else if (ev.key === 'PageUp') { switchChannel(-1); ev.preventDefault(); }
      else if (ev.key === 'PageDown') { switchChannel(1); ev.preventDefault(); }
    });
    setInterval(() => { $('player-clock').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }, 1000);
    window.addEventListener('novaplay:playlists-changed', () => {
      NovaStore.ready.then(() => { state.channels = NovaStore.all().channels; render(); });
    });
  });
})();
