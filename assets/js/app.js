/* =============================================================
   Núcleo do frontend local: relógio, toasts, navegação por setas,
   modais e status. Sem sessão, sem API de usuário.
   ============================================================= */
(function () {
  'use strict';
  const cfg = window.NOVAPLAY || {};

  function toast(message, type = 'info') {
    const region = document.getElementById('toast-region');
    if (!region) return;
    const el = document.createElement('div');
    el.className = 'toast-item' + (type === 'error' ? ' error' : '');
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 4200);
  }

  const loading = {
    show(message) {
      const el = document.getElementById('nova-loading');
      if (!el) return;
      const title = document.getElementById('loading-title');
      const step = document.getElementById('loading-step');
      if (title) title.textContent = message || 'Carregando...';
      if (step) step.textContent = 'Preparando...';
      el.classList.add('show');
    },
    step(message) {
      const el = document.getElementById('loading-step');
      if (el) el.textContent = message || '';
    },
    hide() {
      const el = document.getElementById('nova-loading');
      if (el) el.classList.remove('show');
    }
  };

  /** Modal que funciona mesmo se o CDN do Bootstrap não carregar. */
  function modal(el) {
    if (!el) return { show() {}, hide() {} };
    const inst = (window.bootstrap && bootstrap.Modal) ? new bootstrap.Modal(el) : null;
    let last = null;
    return {
      show() {
        last = document.activeElement;
        if (inst) inst.show();
        else {
          el.classList.add('show');
          el.style.display = 'block';
          el.style.background = 'rgba(0,4,12,.82)';
          el.setAttribute('aria-hidden', 'false');
        }
        setTimeout(() => { const first = el.querySelector(FOCUS_SEL); if (first) setFocus(first); }, inst ? 280 : 40);
      },
      hide() {
        if (inst) inst.hide();
        else {
          el.classList.remove('show');
          el.style.display = 'none';
          el.setAttribute('aria-hidden', 'true');
        }
        setTimeout(() => { if (last) setFocus(last); }, inst ? 300 : 40);
      }
    };
  }
  document.addEventListener('shown.bs.modal', ev => {
    const first = ev.target.querySelector(FOCUS_SEL);
    if (first) setFocus(first);
  });
  document.addEventListener('hidden.bs.modal', ev => {
    if (ev.relatedTarget) setFocus(ev.relatedTarget);
  });

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
  function icon(name, cls = 'ico') { return '<svg class="' + cls + '"><use href="#i-' + name + '"/></svg>'; }
  function formatTime(s) {
    s = Math.max(0, Math.floor(Number(s) || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? String(h).padStart(2, '0') + ':' : '') + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  function startClock() {
    const time = document.getElementById('clock-time');
    const date = document.getElementById('clock-date');
    if (!time || !date) return;
    const t = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const d = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    function tick() { const now = new Date(); time.textContent = t.format(now); date.textContent = d.format(now); }
    tick(); setInterval(tick, 15000);
  }

  const FOCUS_SEL = '[data-focusable], a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';
  function focusables() {
    const openModal = document.querySelector('.modal.show');
    const root = openModal || document;
    const seen = new Set();
    return Array.from(root.querySelectorAll(FOCUS_SEL)).filter(el => {
      if (seen.has(el)) return false;
      seen.add(el);
      if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
      if (el.closest('[data-nav-ignore]')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
    });
  }
  function currentFocus() {
    const a = document.activeElement;
    if (a && focusables().includes(a)) return a;
    return document.querySelector('.is-focused') || null;
  }
  function setFocus(el) {
    if (!el) return;
    document.querySelectorAll('.is-focused').forEach(x => x.classList.remove('is-focused'));
    el.classList.add('is-focused');
    try { el.focus({ preventScroll: false }); } catch (e) { el.focus(); }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
  function move(dir) {
    const items = focusables();
    if (!items.length) return;
    const cur = currentFocus();
    if (!cur) { setFocus(items[0]); return; }
    const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, score = Infinity;
    items.forEach(el => {
      if (el === cur) return;
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const dx = x - ax, dy = y - ay;
      let primary, secondary;
      if (dir === 'right') { primary = dx; secondary = Math.abs(dy); }
      else if (dir === 'left') { primary = -dx; secondary = Math.abs(dy); }
      else if (dir === 'down') { primary = dy; secondary = Math.abs(dx); }
      else { primary = -dy; secondary = Math.abs(dx); }
      if (primary <= 8) return;
      const s = primary + secondary * 2.2;
      if (s < score) { score = s; best = el; }
    });
    if (best) setFocus(best);
  }
  function typing(el) {
    if (!el) return false;
    if (el.closest('[data-nav-ignore]')) return true;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable;
  }

  document.addEventListener('keydown', ev => {
    const active = document.activeElement;
    const inField = typing(active);
    const byKey = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Left: 'left', Right: 'right', Up: 'up', Down: 'down' };
    const byCode = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };
    const dir = byKey[ev.key] || byCode[ev.keyCode];

    if (dir) {
      // Em campos de texto, esquerda/direita movem o cursor; em select, trocam a opção.
      if (inField && ((['INPUT', 'TEXTAREA'].includes(active.tagName) && (dir === 'left' || dir === 'right')) || active.tagName === 'SELECT')) return;
      document.body.classList.add('remote-mode');
      move(dir); ev.preventDefault(); return;
    }

    if (ev.key === 'Enter' || ev.key === ' ' || ev.keyCode === 13) {
      if (inField && active.tagName !== 'BUTTON') return; // formulário / checkbox / select: comportamento nativo
      const cur = currentFocus();
      if (cur && !['A', 'BUTTON'].includes(cur.tagName)) { cur.click(); ev.preventDefault(); }
      return;
    }

    const isBack = ev.key === 'Escape' || ev.key === 'Back' || ev.key === 'Backspace' || ev.key === 'BrowserBack'
      || ev.keyCode === 461 || ev.keyCode === 8 || ev.keyCode === 10009;
    if (isBack) { handleBack(); ev.preventDefault(); }
  });

  /* Roteamento da aplicação de página única -------------------- */
  const VIEWS = ['home', 'live', 'movies', 'series'];
  function go(view) {
    if (!VIEWS.includes(view)) view = 'home';
    if ((location.hash || '').replace('#', '') !== view) location.hash = view;
    else applyView(view);
  }
  function applyView(view) {
    if (!VIEWS.includes(view)) view = 'home';
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    document.querySelectorAll('.spa-nav [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    const back = document.getElementById('btn-back');
    if (back) back.style.display = view === 'home' ? 'none' : 'grid';
    ['home', 'live', 'movies', 'series'].forEach(v => document.body.classList.remove('page-' + v));
    document.body.classList.add('page-' + view);
    cfg.page = view;
    const first = document.querySelector('#view-' + view + ' [data-focusable]');
    if (first) setFocus(first);
  }
  window.addEventListener('hashchange', () => applyView((location.hash || '').replace('#', '') || 'home'));

  /* Voltar em camadas: cada tela pode registrar sua própria ação. */
  const backHandlers = {};
  function onBack(handler, view = '*') {
    if (typeof handler === 'function') backHandlers[view] = handler;
  }
  function handleBack() {
    const active = document.activeElement;
    if (active && (active.tagName === 'SELECT' || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      active.blur(); return;
    }
    const handler = backHandlers[cfg.page] || backHandlers['*'];
    if (handler && handler() === true) return;
    const open = document.querySelector('.modal.show');
    if (open) {
      const inst = window.bootstrap && bootstrap.Modal.getInstance(open);
      if (inst) inst.hide();
      else { open.classList.remove('show'); open.style.display = 'none'; open.setAttribute('aria-hidden', 'true'); }
      return;
    }
    if (cfg.page !== 'home') go('home');
  }

  function connection() {
    const dot = document.getElementById('conn-dot'), label = document.getElementById('conn-label');
    if (!dot || !label) return;
    const online = navigator.onLine !== false;
    dot.classList.toggle('offline', !online);
    label.textContent = online ? 'Pronto' : 'Sem conexão';
  }

  function header() {
    const about = document.getElementById('btn-about');
    if (about) about.addEventListener('click', () => modal(document.getElementById('about-modal')).show());
    const playlists = document.getElementById('btn-playlists');
    if (playlists && window.bootstrap) playlists.addEventListener('click', () => {
      if (window.NovaPlaylists) NovaPlaylists.open();
    });
    const back = document.getElementById('btn-back');
    if (back) back.addEventListener('click', handleBack);
    document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', ev => {
      if (btn.tagName === 'A') ev.preventDefault();
      go(btn.dataset.view);
    }));
    document.querySelectorAll('[data-action="playlists"]').forEach(btn => btn.addEventListener('click', () => {
      if (window.NovaPlaylists) NovaPlaylists.open();
    }));
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    connection();
  }

  function serviceWorker() {
    if ('serviceWorker' in navigator && cfg.name) {
      window.addEventListener('load', () => navigator.serviceWorker.register((cfg.base || '') + '/sw.js').catch(() => {}));
    }
  }

  window.addEventListener('error', ev => {
    console.error('[NovaPlay]', ev.error || ev.message);
    toast('Erro na interface: ' + (ev.message || 'falha desconhecida'), 'error');
  });
  window.addEventListener('unhandledrejection', ev => {
    console.error('[NovaPlay]', ev.reason);
    toast('Falha: ' + ((ev.reason && ev.reason.message) || 'operação não concluída'), 'error');
  });

  window.addEventListener('load', () => {
    connection();
    applyView((location.hash || '').replace('#', '') || 'home');
    if (window.NovaStore) {
      const el = document.getElementById('footer-playlists');
      if (el) {
        const n = NovaStore.state.playlists.length;
        el.textContent = n + (n === 1 ? ' playlist' : ' playlists');
      }
    }
    const first = document.querySelector('.home-grid [data-focusable]') || document.querySelector('[data-focusable]');
    if (first && cfg.page === 'home') setFocus(first);
  });
  startClock(); header(); serviceWorker();

  window.Nova = { cfg, toast, loading, modal, go, applyView, onBack, handleBack, escapeHtml, icon, setFocus, formatTime };
})();
