// Offline-Cache für die App-Hülle. Daten kommen immer frisch von der Schnittstelle.
const CACHE = 'reselling-v2';
const DATEIEN = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Netz zuerst (immer aktuelle Version), bei Offline aus dem Cache
  e.respondWith(fetch(e.request).then(r => {
    const kopie = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, kopie));
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
