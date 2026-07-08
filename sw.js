// ピラミッド犬 Service Worker(PWA / オフライン対応)
const CACHE = 'piramidog-v10';
const CORE = [
  './',
  './index.html',
  './main.js?v=10',
  './style.css?v=10',
  './manifest.json',
  './icon.svg',
  './assets/piramidog.glb?v=tripo-self-1',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // CDN(three.js)はネット優先、ローカルはキャッシュ優先
  const sameOrigin = new URL(e.request.url).origin === self.location.origin;
  if (sameOrigin) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
