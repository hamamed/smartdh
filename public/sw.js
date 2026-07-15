// Minimal service worker: caches static assets, always fetches pages from the
// network (balances must never be stale), falls back to cache when offline.
const CACHE = 'dv-static-v1';
const ASSETS = ['/css/style.css', '/js/app.js', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // never cache POSTs
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // let CDNs handle themselves

  const isAsset = /\.(css|js|png|svg|webmanifest)$/.test(url.pathname);
  if (isAsset) {
    // cache-first for static files
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
  } else {
    // network-first for pages, so balances are always fresh
    e.respondWith(fetch(req).catch(() => caches.match(req)));
  }
});
