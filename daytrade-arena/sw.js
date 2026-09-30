// Day Trade Arena service worker: the game opens offline after the first visit (practice vs bots and
// same-browser tabs work without a connection; online rooms need the internet).
// Network first for game files so updates arrive straight away; the cache is the fallback.
const CACHE = 'daytrade-arena-v2';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/arena.css', './icons/icon-192.png', './icons/icon-512.png',
  './vendor/peerjs.min.js',
  './js/util.js', './js/config.js', './js/market.js', './js/engine.js', './js/indicators.js', './js/bots.js',
  './js/host.js', './js/net.js', './js/client.js', './js/chart.js', './js/widgets.js', './js/fx.js', './js/audio.js',
  './js/ui-core.js', './js/ui-home.js', './js/ui-game.js', './js/ui-results.js', './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('daytrade-arena-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Promise.reject(new Error('offline')))))
  );
});
