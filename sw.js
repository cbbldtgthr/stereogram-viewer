/**
 * Offline shell. When you change index.html, app.js, style.css, or examples,
 * bump CACHE so clients refetch the precache list.
 */
const CACHE = 'stereogram-pwa-v1';

const PRECACHE_URLS = [
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.ico',
  'examples/flowers/left.jpg',
  'examples/flowers/right.jpg',
  'examples/cathedral_landscape/left.jpg',
  'examples/cathedral_landscape/right.jpg',
  'examples/cathedral_portrait/left.jpg',
  'examples/cathedral_portrait/right.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    const indexUrl = new URL('index.html', self.location).href;
    event.respondWith(
      fetch(request).catch(() => caches.match(indexUrl))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
