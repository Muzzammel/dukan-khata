/* Dukan Khata service worker — offline-first app shell.
   - Network-first for navigations (so you always get the latest when online,
     but the cached shell loads instantly / when offline).
   - Cache-first for hashed static assets (fast repeat loads).
   - API calls are never cached (data freshness handled in the app + outbox).
*/
const CACHE = 'dukan-khata-v4';
const SHELL = ['/dashboard', '/login', '/manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;     // skip cross-origin (fonts, Gemini, Supabase)
  if (url.pathname.startsWith('/api/')) return;         // never cache API responses

  // Navigations: network-first, fall back to cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => { cachePut(request, res.clone()); return res; })
        .catch(() => caches.match(request).then((m) => m || caches.match('/dashboard')))
    );
    return;
  }

  // Static assets: cache-first, then network (and cache it).
  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((res) => { cachePut(request, res.clone()); return res; }).catch(() => cached)
    )
  );
});

function cachePut(request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return;
  caches.open(CACHE).then((c) => c.put(request, response)).catch(() => {});
}
