/**
 * Offline shell. When you change index.html, app.js, style.css, or examples,
 * bump CACHE so old entries are dropped on activate.
 */
const CACHE = 'stereogram-pwa-v2';

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

  const indexUrl = new URL('index.html', self.location).href;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(indexUrl))
    );
    return;
  }

  // Network-first: avoids serving a poisoned cache (e.g. HTML mistaken for app.js)
  // while still allowing offline once a good response has been cached.
  event.respondWith(
    (async () => {
      try {
        const net = await fetch(request);
        if (net.ok && net.type === 'basic') {
          const cache = await caches.open(CACHE);
          await cache.put(request, net.clone());
        }
        return net;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })()
  );
});
