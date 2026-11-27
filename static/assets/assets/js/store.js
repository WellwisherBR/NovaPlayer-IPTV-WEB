/* =============================================================
   Armazenamento local — sem usuário e sem banco.
   Metadados (playlists/credenciais/favoritos) no localStorage;
   conteúdo (canais/filmes/séries) no IndexedDB, com fallback
   para localStorage quando IndexedDB não estiver disponível.
   ============================================================= */
(function () {
  'use strict';
  const META_KEY = window.NOVA_STORAGE_KEY || 'novaplay:v1';
  const DB_NAME = window.NOVA_DB_NAME || 'novaplay';
  const DB_STORE = 'kv';

  const defaultMeta = () => ({
    playlists: [], favorites: [], history: [], selectedId: null,
    settings: { engine: 'hlsjs', autoplay: false }
  });

  let meta;
  let legacyContent = null;
  try {
    const raw = JSON.parse(localStorage.getItem(META_KEY) || 'null');
    if (raw) {
      meta = Object.assign(defaultMeta(), raw);
      if (raw.content) { legacyContent = raw.content; delete meta.content; }
    } else {
      meta = defaultMeta();
    }
  } catch (e) { meta = defaultMeta(); }

  const state = Object.assign({}, meta, { content: {} });
  let useIDB = typeof indexedDB !== 'undefined';
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  function idbGet(key) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }
  function idbPut(key, value) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    }));
  }

  /** Pronto quando o conteúdo já foi carregado do IndexedDB. */
  const ready = (async () => {
    if (!useIDB) {
      if (legacyContent) state.content = legacyContent;
      return;
    }
    try {
      const saved = await idbGet('content');
      if (saved && Object.keys(saved).length) state.content = saved;
      else if (legacyContent) { state.content = legacyContent; await idbPut('content', state.content); }
      // remove conteúdo do localStorage legado, liberando espaço
      if (legacyContent) saveMeta();
    } catch (e) {
      useIDB = false;
      if (legacyContent) state.content = legacyContent;
      console.warn('IndexedDB indisponível, usando localStorage:', e);
    }
  })();

  function saveMeta() {
    const clean = {
      playlists: state.playlists, favorites: state.favorites, history: state.history,
      selectedId: state.selectedId, settings: state.settings
    };
    try { localStorage.setItem(META_KEY, JSON.stringify(clean)); return true; }
    catch (e) { console.warn('localStorage cheio:', e); return false; }
  }

  /** Persiste tudo. Sempre aguarde esta Promise antes de navegar. */
  function persist() {
    const ok = saveMeta();
    if (!useIDB) {
      try { localStorage.setItem(META_KEY, JSON.stringify(Object.assign(JSON.parse(localStorage.getItem(META_KEY) || '{}'), { content: state.content }))); }
      catch (e) { console.warn('Sem espaço para o conteúdo:', e); }
      return Promise.resolve(ok);
    }
    return idbPut('content', state.content).then(() => true).catch(e => {
      console.warn('Falha ao salvar conteúdo no IndexedDB:', e);
      return false;
    });
  }

  function uid() { return 'pl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }

  async function api(path, body) {
    const res = await fetch((window.NOVAPLAY && NOVAPLAY.base ? NOVAPLAY.base : '') + '/api/proxy/' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body || {})
    });
    let json;
    try { json = await res.json(); } catch (e) { throw new Error('Servidor proxy indisponível (verifique se o site está rodando sob PHP).'); }
    if (!res.ok || !json.ok) throw new Error(json.error || 'Erro na requisição.');
    return json.data;
  }

  async function sync(playlistId, text) {
    const p = getPlaylist(playlistId);
    if (!p) throw new Error('Playlist não encontrada.');
    let data;
    try {
      data = p.type === 'xtream'
        ? await api('xtream.php', { url: p.url, username: p.username, password: p.password, action: 'all' })
        : await api('m3u.php', text ? { text } : { url: p.url });
    } catch (e) {
      p.lastError = e.message; p.lastSyncAt = new Date().toISOString();
      await persist();
      throw e;
    }
    state.content[p.id] = Object.assign({}, data, { syncedAt: new Date().toISOString() });
    p.lastError = null; p.lastSyncAt = new Date().toISOString();
    const saved = await persist(); // garante que o conteúdo esteja salvo antes de qualquer navegação
    if (!saved) throw new Error('Não foi possível salvar o conteúdo no dispositivo. Libere espaço e tente novamente.');
    return data.counts;
  }

  async function loadEpisodes(series) {
    const p = getPlaylist(series.sourceId);
    if (!p || p.type !== 'xtream' || !series.providerId) return series;
    const data = await api('xtream.php', { url: p.url, username: p.username, password: p.password,
      action: 'get_series_info', id: series.providerId, series_id: series.providerId });
    const episodes = [];
    Object.entries(data.episodes || {}).forEach(([season, list]) => {
      (list || []).forEach(ep => {
        episodes.push({
          id: 'ep-' + (ep.id || ''), season: Number(season), episode: Number(ep.episode_num || 0),
          name: String(ep.title || 'Episódio').slice(0, 180),
          description: String(ep.plot || '').slice(0, 2000), poster: ep.movie_image || '',
          url: ep.direct_source || (p.url.replace(/\/$/, '') + '/series/' + encodeURIComponent(p.username) + '/' + encodeURIComponent(p.password) + '/' + ep.id + '.' + (ep.container || 'mp4')),
          altUrl: (!ep.direct_source && String(ep.container || 'mp4').toLowerCase() !== 'mp4')
            ? (p.url.replace(/\/$/, '') + '/series/' + encodeURIComponent(p.username) + '/' + encodeURIComponent(p.password) + '/' + ep.id + '.mp4') : ''
        });
      });
    });
    const content = state.content[p.id];
    if (content) {
      const target = (content.series || []).find(s => s.id === series.id);
      if (target) { target.episodes = episodes; await persist(); }
    }
    return Object.assign({}, series, { episodes });
  }

  function getPlaylist(id) { return state.playlists.find(p => p.id === id) || null; }
  function addPlaylist(data) {
    const p = Object.assign({ id: uid(), createdAt: new Date().toISOString() }, data);
    state.playlists.unshift(p); saveMeta(); return p;
  }
  function updatePlaylist(id, data) {
    const p = getPlaylist(id); if (!p) return null;
    Object.assign(p, data); saveMeta(); return p;
  }
  function removePlaylist(id) {
    state.playlists = state.playlists.filter(p => p.id !== id);
    delete state.content[id];
    if (state.selectedId === id) state.selectedId = null;
    persist();
  }
  function selectPlaylist(id) { state.selectedId = id || null; saveMeta(); }
  function selectedPlaylist() { return state.selectedId ? getPlaylist(state.selectedId) : null; }

  function all() {
    const channels = [], movies = [], series = [];
    const list = state.selectedId ? state.playlists.filter(p => p.id === state.selectedId) : state.playlists;
    list.forEach(p => {
      const c = state.content[p.id];
      if (!c) return;
      (c.channels || []).forEach(x => channels.push(Object.assign({ source: p.name, sourceId: p.id }, x)));
      (c.movies || []).forEach(x => movies.push(Object.assign({ source: p.name, sourceId: p.id }, x)));
      (c.series || []).forEach(x => series.push(Object.assign({ source: p.name, sourceId: p.id }, x)));
    });
    return { channels, movies, series };
  }

  function isFavorite(type, id) { return state.favorites.some(f => f.type === type && String(f.id) === String(id)); }
  function toggleFavorite(type, id) {
    if (isFavorite(type, id)) state.favorites = state.favorites.filter(f => !(f.type === type && String(f.id) === String(id)));
    else state.favorites.push({ type, id: String(id) });
    saveMeta();
    return isFavorite(type, id);
  }
  function progress(type, id) { return state.history.find(h => h.type === type && String(h.id) === String(id)) || null; }
  function saveProgress(type, id, info) {
    const item = Object.assign({ type, id: String(id), updatedAt: Date.now() }, info);
    const idx = state.history.findIndex(h => h.type === type && String(h.id) === String(id));
    if (idx >= 0) state.history[idx] = Object.assign(state.history[idx], item); else state.history.unshift(item);
    if (state.history.length > 300) state.history.length = 300;
    saveMeta();
  }
  function clearHistory() { state.history = []; saveMeta(); }
  function setting(key, fallback) { return key in state.settings ? state.settings[key] : fallback; }
  function setSetting(key, value) { state.settings[key] = value; saveMeta(); }

  window.NovaStore = {
    get state() { return state; },
    ready, persist, api, sync, loadEpisodes, uid,
    getPlaylist, addPlaylist, updatePlaylist, removePlaylist,
    selectPlaylist, selectedPlaylist,
    all, isFavorite, toggleFavorite, progress, saveProgress, clearHistory,
    setting, setSetting,
    counts: () => { const c = all(); return { channels: c.channels.length, movies: c.movies.length, series: c.series.length }; }
  };
})();
