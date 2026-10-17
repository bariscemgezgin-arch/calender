const CACHE = 'dopamin-v2';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/streak.js', 'js/store.js', 'js/gcal.js', 'js/plan.js', 'js/sync.js', 'widget/dopamin-widget.js', 'manifest.webmanifest', 'icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
// Ağ öncelikli (güncellemeler hemen gelsin), çevrimdışıyken önbellek.
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return r;
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match('index.html'))),
  );
});
