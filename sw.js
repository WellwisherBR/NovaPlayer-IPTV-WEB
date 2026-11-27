/* Service worker — cache do app shell. Nada de dados de usuário é cacheado aqui. */
const CACHE = 'novaplay-local-20261127o';
const SHELL = [
  './',
  './manifest.json',
  './assets/css/base.css',
  './assets/css/home.css',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/home.js',
  './assets/js/store.js',
  './assets/js/playlists.js',
  './assets/js/player.js',
  './assets/js/vendor/bootstrap.bundle.min.js',
  './assets/js/vendor/hls.min.js',
  './assets/js/vendor/video.min.js',
  './assets/css/vendor/bootstrap.min.css',
  './assets/css/vendor/video-js.min.css',
  './assets/logos/logo.svg',
  './assets/icons/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return; // proxy sempre direto no servidor
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(event.request, copy));
      return res;
    }).catch(() => caches.match(event.request).then(r => r || caches.match('./index.php'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => {
    const network = fetch(event.request).then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(event.request, copy));
      }
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
