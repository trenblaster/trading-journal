// Study Town service worker: lets the game open offline once it has been visited.
// Network first for the game files so updates arrive straight away; cache as a fallback.
const CACHE = 'study-town-v2';
const FILES = [
  './', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './js/bank-core.js', './js/bank-econ.js', './js/bank-econ-2.js', './js/bank-econ-3.js', './js/bank-econ-p2.js',
  './js/bank-acc.js', './js/bank-acc-2.js', './js/bank-acc-p2.js', './js/bank-eng.js', './js/bank-eng-2.js',
  './js/graphs.js', './js/game.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('study-town-') && k !== CACHE).map((k) => caches.delete(k))))
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
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Promise.reject(new Error('offline')))))
  );
});
