// Revision Rally service worker: network first, cached copy when offline.
const CACHE = 'revision-rally-v1';
const SHARED = ['bank-core', 'bank-econ', 'bank-econ-2', 'bank-econ-3', 'bank-econ-p2', 'bank-acc', 'bank-acc-2', 'bank-acc-p2', 'bank-eng', 'bank-eng-2', 'graphs'].map((f) => `../study-town/js/${f}.js`);
const FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './js/sprites.js', './js/track.js', './js/race.js', './js/ui.js'].concat(SHARED);
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('revision-rally-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then((res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Promise.reject(new Error('offline'))))));
});
