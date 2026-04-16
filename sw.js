const CACHE = 'stereogram-v1';

const PRECACHE = [
  '/',
  '/app.js',
  '/style.css',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/examples/flowers/left.jpg',
  '/examples/flowers/right.jpg',
  '/examples/cathedral_landscape/left.jpg',
  '/examples/cathedral_landscape/right.jpg',
  '/examples/cathedral_portrait/left.jpg',
  '/examples/cathedral_portrait/right.jpg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for same-origin assets, network-only for everything else
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
