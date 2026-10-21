// Yalnızca uygulama kabuğunu önbelleğe alır (çevrimdışı açılış). Çocuk verisi Firestore'un kendi şifreli yerel önbelleğinde durur.
const CACHE = 'ergofit-shell-v1';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/csv.js', 'js/backend-firebase.js', 'js/backend-demo.js', 'js/firebase-config.js', 'assets/logo.svg', 'manifest.webmanifest'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // ağ öncelikli: güncel sürüm varsa onu al, yoksa önbellek
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
