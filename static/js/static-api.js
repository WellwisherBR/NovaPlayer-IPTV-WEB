/* =============================================================
   Versão estática: substitui o proxy PHP por chamadas feitas
   diretamente do navegador. Limitação: o provedor precisa
   permitir CORS; se não permitir, use a versão PHP.
   ============================================================= */
(function () {
  'use strict';
  const HINT = 'O provedor não permite acesso direto pelo navegador (CORS). Use a versão PHP em uma hospedagem com proxy.';

  async function get(url, json = false) {
    let res;
    try {
      res = await fetch(url, { method: 'GET', headers: { 'Accept': json ? 'application/json' : '*/*' } });
    } catch (e) {
      throw new Error(HINT);
    }
    if (!res.ok) throw new Error('Provedor respondeu HTTP ' + res.status + '.');
    try { return json ? await res.json() : await res.text(); }
    catch (e) { throw new Error('Resposta inválida do provedor.'); }
  }

  function hash(value) {
    let h = 0;
    const s = String(value);
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  }

  function resolveUrl(base, rel) {
    if (/^https?:\/\//i.test(rel)) return rel;
    if (!base) return rel;
    let u;
    try { u = new URL(base); } catch (e) { return rel; }
    if (rel.startsWith('/')) return u.origin + rel;
    return new URL(rel, u.href).href;
  }

  function parseExtinf(line) {
    const attrs = {};
    let m;
    const re = /([\w-]+)="([^"]*)"/g;
    while ((m = re.exec(line)) !== null) attrs[m[1].toLowerCase()] = m[2];
    const comma = line.lastIndexOf(',');
    const name = comma >= 0 ? line.slice(comma + 1).trim() : '';
    return { attrs, name };
  }

  function detectType(text) {
    const s = String(text).toLowerCase();
    if (/(filme|movie|\bvod\b|video_on_demand)/.test(s)) return 'movie';
    if (/(serie|séries|series|episod|anime|s\d{1,2}e\d{1,3})/.test(s)) return 'series';
    return 'live';
  }

  function parseSeriesTitle(name) {
    let m = name.match(/^(.*?)\s*[-–]\s*S?(\d{1,2})[xE](\d{1,3})\b/i);
    if (m) return { series: m[1].trim(), season: +m[2], episode: +m[3] };
    m = name.match(/\bS(\d{1,2})E(\d{1,3})\b/i);
    if (m) return { series: name.replace(/\bS\d{1,2}E\d{1,3}\b.*$/i, '').trim(), season: +m[1], episode: +m[2] };
    return { series: name, season: 0, episode: 0 };
  }

  function parseM3u(text, baseUrl) {
    const channels = [], movies = [], series = [];
    const seriesIndex = {};
    const liveGroups = [], movieGroups = [], seriesGroups = [];
    const lines = String(text).split(/\r\n|\r|\n/);
    let extinf = null, groupOverride = null, number = 0;

    lines.forEach(raw => {
      const line = raw.trim();
      if (!line) return;
      if (line.startsWith('#')) {
        if (line.startsWith('#EXTGRP:')) groupOverride = line.slice(8).trim();
        if (line.startsWith('#EXTINF:')) extinf = parseExtinf(line);
        return;
      }
      const url = resolveUrl(baseUrl || '', line);
      const attrs = extinf ? extinf.attrs : {};
      const group = groupOverride || attrs['group-title'] || 'Outros';
      const name = (extinf && extinf.name ? extinf.name : url.split('/').pop() || 'Canal').trim() || ('Canal ' + (number + 1));
      const logo = attrs['tvg-logo'] || '';
      const type = detectType(group + ' ' + url + ' ' + name);
      const id = hash(name + '|' + url);
      number++;

      if (type === 'live') {
        if (!liveGroups.includes(group)) liveGroups.push(group);
        channels.push({ id, name, logo, group, url, number: +(attrs['tvg-chno'] || attrs['chno'] || number),
          catchup: !!(attrs.catchup || attrs['tvg-rec']) });
      } else if (type === 'movie') {
        if (!movieGroups.includes(group)) movieGroups.push(group);
        movies.push({ id, name, poster: logo, group, url, year: null, genre: '', description: '' });
      } else {
        const parsed = parseSeriesTitle(name);
        const sName = parsed.series || name;
        const sid = hash(sName);
        if (!seriesGroups.includes(group)) seriesGroups.push(group);
        if (!(sid in seriesIndex)) {
          seriesIndex[sid] = series.length;
          series.push({ id: sid, name: sName, poster: logo, group, description: '', year: null, genre: '', episodes: [] });
        }
        series[seriesIndex[sid]].episodes.push({
          id: hash(url), season: parsed.season || 1, episode: parsed.episode || 1,
          name, description: '', poster: logo, url
        });
      }
      extinf = null; groupOverride = null;
    });

    return {
      channels, movies, series,
      categories: { live: liveGroups, movies: movieGroups, series: seriesGroups },
      counts: { channels: channels.length, movies: movies.length, series: series.length }
    };
  }

  function streamUrl(base, user, pass, type, id, ext) {
    return base.replace(/\/$/, '') + '/' + type + '/' + encodeURIComponent(user) + '/' + encodeURIComponent(pass) + '/' + encodeURIComponent(id) + '.' + ext;
  }

  async function xtream(base, user, pass, action, extra) {
    const params = new URLSearchParams(Object.assign({ username: user, password: pass, action }, extra || {}));
    return get(base.replace(/\/$/, '') + '/player_api.php?' + params.toString(), true);
  }

  async function normalizeXtream(base, user, pass) {
    const channels = [], movies = [], series = [];
    const liveCats = {}, movieCats = {}, seriesCats = {};
    (await xtream(base, user, pass, 'get_live_categories')).forEach(c => { liveCats[c.category_id] = c.category_name || 'Outros'; });
    (await xtream(base, user, pass, 'get_live_streams')).forEach((s, i) => {
      const id = String(s.stream_id || '');
      if (!id) return;
      channels.push({
        id: 'ch-' + id, name: s.name || 'Canal', logo: s.stream_icon || '',
        group: liveCats[s.category_id] || 'Outros',
        url: s.direct_source || streamUrl(base, user, pass, 'live', id, 'm3u8'),
        fallbackUrl: s.direct_source ? '' : streamUrl(base, user, pass, 'live', id, 'ts'),
        number: i + 1, catchup: !!s.tv_archive, epgId: s.epg_channel_id || '', streamId: id
      });
    });
    (await xtream(base, user, pass, 'get_vod_categories')).forEach(c => { movieCats[c.category_id] = c.category_name || 'Outros'; });
    (await xtream(base, user, pass, 'get_vod_streams')).forEach(m => {
      const id = String(m.stream_id || '');
      if (!id) return;
      const ext = m.container || 'mp4';
      movies.push({
        id: 'movie-' + id, name: m.name || 'Filme', poster: m.stream_icon || '',
        group: movieCats[m.category_id] || 'Outros',
        url: m.direct_source || streamUrl(base, user, pass, 'movie', id, ext),
        altUrl: (!m.direct_source && String(ext).toLowerCase() !== 'mp4') ? streamUrl(base, user, pass, 'movie', id, 'mp4') : '',
        year: +m.year || null, genre: m.genre || '', rating: m.rating || '', description: m.description || ''
      });
    });
    (await xtream(base, user, pass, 'get_series_categories')).forEach(c => { seriesCats[c.category_id] = c.category_name || 'Outros'; });
    (await xtream(base, user, pass, 'get_series')).forEach(s => {
      const id = String(s.series_id || '');
      if (!id) return;
      series.push({
        id: 'series-' + id, providerId: id, name: s.name || 'Série', poster: s.cover || '',
        group: seriesCats[s.category_id] || 'Outros', year: +s.year || null,
        genre: s.genre || '', rating: s.rating || '', description: s.plot || '', episodes: []
      });
    });
    return {
      channels, movies, series,
      categories: { live: Object.values(liveCats), movies: Object.values(movieCats), series: Object.values(seriesCats) },
      counts: { channels: channels.length, movies: movies.length, series: series.length }
    };
  }

  async function api(path, body) {
    if (path === 'm3u.php') {
      const text = body.text || await get(body.url);
      return parseM3u(text, body.url || '');
    }
    if (path === 'xtream.php') {
      const { url, username, password, action } = body;
      if (!url || !username || !password) throw new Error('Informe URL, usuário e senha do provedor.');
      if (body.base && /player_api\.php/i.test(url)) {
        // URL completa de API: extrai apenas a base.
        const u = new URL(url);
        const parts = u.pathname.split('/');
        const idx = parts.findIndex(p => /player_api\.php/i.test(p));
        if (idx >= 0) parts.length = idx;
        url = u.origin + parts.join('/');
      }
      if (!action || action === 'all') return normalizeXtream(url, username, password);
      const extra = {};
      if (body.id) extra.id = body.id;
      if (body.series_id) extra.series_id = body.series_id;
      if (body.stream_id) extra.stream_id = body.stream_id;
      return xtream(url, username, password, action, extra);
    }
    throw new Error('Endpoint não disponível na versão estática.');
  }

  if (window.NovaStore) {
    NovaStore.setApi(api);
    NovaStore.api = api; // usado diretamente por live.js (EPG)
  }
})();
