// Simple PWA service worker for app shell + runtime caching of /Cards/*
// Works on HTTPS static hosting, including Cloudflare Workers.

const CACHE_NAME = 'card-dealer-v24';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './ai-clue.js',
  './manifest.webmanifest',
  './icons/loteria-icon.svg',
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

// Fetch: keep card data available offline; refresh the app shell from the network first.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Runtime cache for cards
  if (url.pathname.includes('/Cards/')) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Recorded calls are immutable assets; cache them after the first warm-up request.
  if (url.pathname.includes('/audio/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isAppShell = event.request.mode === 'navigate'
    || ['script', 'style', 'manifest'].includes(event.request.destination);

  if (isAppShell) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request) || await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

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

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
}
