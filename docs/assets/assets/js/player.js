/* =============================================================
   Player universal: HLS.js / Video.js / HTML5 nativo.
   Uso: const p = NovaPlayer.create(videoEl, {engine:'hlsjs'});
        await p.playSigned('channel', 12);
   ============================================================= */
(function () {
  'use strict';

  function create(video, options = {}) {
    const opts = Object.assign({ engine: 'hlsjs', onTime: null, onEnded: null, onError: null }, options);
    let hls = null, vjs = null, currentUrl = '', meta = null, lastProgress = 0, suppressErrors = false, nativeRetry = false;
    const tried = new Set();
    function preferences() {
      return {
        audio_lang: (window.NovaStore && NovaStore.setting('audio_lang', 'por')) || 'por',
        subtitle_lang: (window.NovaStore && NovaStore.setting('subtitle_lang', 'off')) || 'off'
      };
    }
    function applyTracks() {
      if (!hls) return;
      const prefs = preferences();
      const wantedAudio = String(prefs.audio_lang || '').slice(0, 3).toLowerCase();
      const wantedSub = String(prefs.subtitle_lang || 'off').slice(0, 3).toLowerCase();
      if (wantedAudio && hls.audioTracks && hls.audioTracks.length) {
        const idx = hls.audioTracks.findIndex(t => String(t.lang || t.name || '').toLowerCase().startsWith(wantedAudio));
        if (idx >= 0) hls.audioTrack = idx;
      }
      if (hls.subtitleTracks && hls.subtitleTracks.length) {
        const idx = wantedSub === 'off' ? -1 : hls.subtitleTracks.findIndex(t => String(t.lang || t.name || '').toLowerCase().startsWith(wantedSub));
        if (idx >= 0) { hls.subtitleTrack = idx; hls.subtitleDisplay = true; }
        else { hls.subtitleTrack = -1; hls.subtitleDisplay = false; }
      }
    }

    function emitTime() {
      if (!opts.onTime) return;
      const d = isFinite(video.duration) ? video.duration : 0;
      opts.onTime({ current: video.currentTime || 0, duration: d, paused: video.paused });
    }

    function bindVideo() {
      video.addEventListener('timeupdate', () => {
        emitTime();
        const now = Date.now();
        if (now - lastProgress > 8000) { lastProgress = now; emitTime(); }
      });
      video.addEventListener('ended', () => { if (opts.onEnded) opts.onEnded(); });
      video.addEventListener('error', () => {
        // video.load() ao trocar de fonte gera um erro falso; ignore-o.
        if (suppressErrors || !currentUrl) return;
        const err = video.error;
        const detail = err ? ' (código ' + err.code + ': ' + (err.message || 'erro de mídia') + ')' : '';
        console.error('[NovaPlay] falha de mídia ' + JSON.stringify({ url: currentUrl, code: err && err.code, message: err && err.message }));
        // Segunda tentativa pelo proxy apenas para HLS (não para arquivos de vídeo grandes).
        const isBigFile = /\.(mp4|m4v|mkv|avi|mov|webm|ts)(\?|$)/i.test(currentUrl.split('?')[0]);
        // Erro de formato: tenta containers alternativos do mesmo provedor.
        if (err && err.code === 4) {
          const base = currentUrl.split('?')[0];
          const candidates = [];
          if (meta && meta.altUrl) candidates.push(meta.altUrl);
          if (/\.ts$/i.test(base)) candidates.push(base.replace(/\.ts$/i, '.m3u8'), base.replace(/\.ts$/i, '.mp4'));
          if (/\.(mkv|avi|mov|webm)$/i.test(base)) candidates.push(base.replace(/\.[^.]+$/, '.mp4'));
          const next = candidates.find(u => u && u !== currentUrl && !tried.has(u));
          if (next) {
            tried.add(next);
            load(next);
            return;
          }
        }
        if (!nativeRetry && !isBigFile && !window.NOVA_STATIC && /^https?:\/\//i.test(currentUrl)) {
          nativeRetry = true;
          const base = String((window.NOVAPLAY && NOVAPLAY.base) || '').replace(/\/$/, '');
          try {
            video.src = base + '/api/proxy/hls.php?url=' + encodeURIComponent(currentUrl);
            video.load();
            const p = video.play();
            if (p && p.catch) p.catch(() => {});
            return;
          } catch (e) { /* segue para o aviso */ }
        }
        if (opts.onError) opts.onError('Não foi possível reproduzir esta fonte' + detail);
      });
    }
    bindVideo();

    function destroyEngine() {
      suppressErrors = true;
      nativeRetry = false;
      if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
      video.removeAttribute('src');
      try { video.load(); } catch (e) {}
      setTimeout(() => { suppressErrors = false; }, 60);
    }

    function load(url) {
      destroyEngine();
      currentUrl = url;
      const clean = String(url).split('?')[0].toLowerCase();
      const isFile = /\.(mp4|m4v|mkv|avi|mov|webm|ts)(\?|$)/i.test(clean);
      const type = /\.(mp4|m4v)(\?|$)/i.test(clean) ? 'video/mp4'
        : (/\.webm(\?|$)/i.test(clean) ? 'video/webm' : 'application/x-mpegURL');

      if (opts.engine === 'videojs' && window.videojs) {
        if (vjs) { try { vjs.dispose(); } catch (e) {} vjs = null; }
        // Video.js substitui o elemento; recria o nó para garantir estado limpo.
        const clone = video.cloneNode(true);
        video.parentNode.replaceChild(clone, video);
        video = clone;
        bindVideo();
        vjs = window.videojs(video, { controls: true, fluid: true, responsive: true, html5: { vhs: { overrideNative: true } } });
        vjs.src({ src: url, type });
        vjs.one('loadedmetadata', () => { try { const p = vjs.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} });
        vjs.on('error', () => { if (opts.onError) opts.onError('Erro ao carregar o vídeo (Video.js).'); });
        return Promise.resolve();
      }
      const canNativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== '';
      if (canNativeHls) {
        video.src = url;
        return video.play().catch(() => {});
      }
      if (!isFile && window.Hls && Hls.isSupported()) {
        let networkRetries = 0, mediaRetries = 0;
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 60,
          maxBufferLength: 30,
          manifestLoadingMaxRetry: 2,
          levelLoadingMaxRetry: 3,
          fragLoadingMaxRetry: 3,
        });
        // Na versão PHP usa o proxy (evita CORS); na versão estática usa a URL direta.
        if (window.NOVA_STATIC) {
          hls.loadSource(url);
        } else {
          const base = String((window.NOVAPLAY && NOVAPLAY.base) || '').replace(/\/$/, '');
          hls.loadSource(base + '/api/proxy/hls.php?url=' + encodeURIComponent(url));
        }
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          applyTracks();
          try { const p = video.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries++ < 1) {
            hls.startLoad(); // tentativa de reconexão
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries++ < 1) {
            hls.recoverMediaError();
          } else {
            // Último recurso: deixar o navegador tentar a fonte diretamente.
            try { hls.destroy(); } catch (e) {}
            hls = null;
            video.src = url;
            video.play().catch(() => {});
            if (opts.onError) opts.onError('Formato incompatível; tentando reprodução nativa.');
          }
        });
        return Promise.resolve();
      }
      video.src = url; // MP4 ou outro formato suportado pelo navegador
      return video.play().catch(() => {});
    }

    async function playDirect(url, metaInfo) {
      if (!url) throw new Error('Esta fonte não possui URL de reprodução.');
      meta = metaInfo || { url };
      tried.clear(); tried.add(url);
      await load(url);
      return meta;
    }

    return {
      video: () => video,
      meta: () => meta,
      load,
      playDirect,
      play() {
        if (!currentUrl && !vjs) return Promise.resolve();
        try {
          const p = vjs ? vjs.play() : video.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
          return p;
        } catch (e) { return Promise.resolve(); }
      },
      pause() { try { if (vjs) vjs.pause(); else video.pause(); } catch (e) {} },
      toggle() {
        try {
          if (!currentUrl && !vjs) return Promise.resolve();
          if (vjs) return vjs.paused() ? this.play() : (vjs.pause(), Promise.resolve());
          return video.paused ? this.play() : (video.pause(), Promise.resolve());
        } catch (e) { return Promise.resolve(); }
      },
      setVolume(v) { const val = Math.max(0, Math.min(1, v)); if (vjs) vjs.volume(val); else video.volume = val; },
      getVolume: () => (vjs ? vjs.volume() : video.volume),
      toggleMute() { if (vjs) vjs.muted(!vjs.muted()); else video.muted = !video.muted; },
      seek(seconds) { const t = (vjs ? vjs.currentTime() : video.currentTime) + seconds; if (vjs) vjs.currentTime(t); else video.currentTime = t; },
      fullscreen() {
        if (document.fullscreenElement) { this.exitFullscreen(); return; }
        this.enterFullscreen();
      },
      /** Entra em tela cheia. Chamar no mesmo gesto de clique do usuário. */
      enterFullscreen() {
        const el = video.parentElement || video;
        if (document.fullscreenElement) return;
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (req) {
          try {
            const result = req.call(el);
            if (result && typeof result.catch === 'function') result.catch(() => {});
          } catch (e) { /* navegador pode bloquear; segue em janela */ }
        }
      },
      exitFullscreen() {
        if (document.fullscreenElement && document.exitFullscreen) {
          try { const r = document.exitFullscreen(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
        }
      },
      qualities() {
        if (hls && hls.levels && hls.levels.length > 1) {
          return hls.levels.map((lv, i) => ({ index: i, label: lv.height ? lv.height + 'p' : 'Nível ' + (i + 1) }));
        }
        return [];
      },
      setQuality(index) { if (hls) hls.currentLevel = index; },
      destroy() { destroyEngine(); if (vjs) { try { vjs.dispose(); } catch (e) {} vjs = null; } },
      currentUrl: () => currentUrl,
    };
  }

  window.NovaPlayer = { create };
})();
