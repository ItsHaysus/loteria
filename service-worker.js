// Simple PWA service worker for app shell + runtime caching of /cards/*
// Works on GitHub Pages (HTTPS required)

const CACHE_NAME = 'card-dealer-v1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE_NAME) ? null : caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: app shell from cache first; runtime cache for /cards and /cards/cards.json
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Runtime cache for cards
  if (url.pathname.startsWith('/cards/')) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  return cached || networkFetch;
}
