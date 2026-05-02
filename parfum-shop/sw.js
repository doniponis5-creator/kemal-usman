const CACHE_NAME = 'kemal-usman-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Network first for API calls, cache first for static assets
  const url = new URL(event.request.url);
  // FIX: domain-agnostic — match any PocketBase API path or hostname so the
  // HTTPS migration doesn't break offline cache. Match /api/, /_/, or any URL
  // whose pathname starts with /api/files/.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_/')) {
    // Network only for PocketBase
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
