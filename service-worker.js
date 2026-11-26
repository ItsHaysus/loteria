// Simple PWA service worker for app shell + runtime caching of /Cards/*
// Works on HTTPS static hosting, including Cloudflare Workers.

const CACHE_NAME = 'card-dealer-v32';
const pendingAssets = new Map();
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=1.5.1',
  './script.js?v=1.5.2',
  './ai-clue.js?v=1.4.4',
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

// Activate: cleanup old caches before claiming pages.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('card-dealer-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.includes('/Cards/')) {
    const getResponse = url.pathname.endsWith('.json') ? networkFirst : cacheAsset;
    event.respondWith(getResponse(event.request));
    return;
  }

  // Recorded calls are immutable assets; cache them after the first warm-up request.
  if (url.pathname.includes('/audio/')) {
    event.respondWith(serveAudio(event.request));
    return;
  }

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
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const url = request.url;
  if (!pendingAssets.has(url)) {
    const download = (async () => {
      const response = await fetch(request);
      if (response.status === 200) {
        await cache.put(request, response.clone()).catch(error => {
          console.warn(`[cache] Could not store ${url}:`, error);
        });
      }
      return response;
    })().finally(() => pendingAssets.delete(url));
    pendingAssets.set(url, download);
  }
  return (await pendingAssets.get(url)).clone();
}

async function serveAudio(request) {
  const range = request.headers.get('Range');
  const fullRequest = range ? new Request(request.url) : request;
  const response = await cacheAsset(fullRequest);

  const bounds = /^bytes=(\d*)-(\d*)$/i.exec(range || '');
  if (!bounds || response.status !== 200) return response;

  // Safari requests byte ranges even for small audio clips. Store whole files for offline use.
  const blob = await response.blob();
  const [, first, last] = bounds;
  const start = first ? Number(first) : Math.max(0, blob.size - Number(last));
  const end = first && last ? Math.min(blob.size - 1, Number(last)) : blob.size - 1;
  if (start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${blob.size}` } });
  }

  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${blob.size}`,
      'Content-Type': blob.type,
    },
  });
}
