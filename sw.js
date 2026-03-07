// =====================================================
// THRUSTFALL — Service Worker (Offline Cache)
// =====================================================
const CACHE_NAME = 'thrustfall-v2';
const ASSETS = [
    '/',
    '/index.html'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    // Only cache GET requests, skip WebSocket upgrades
    if (e.request.method !== 'GET') return;
    // Network-first for HTML (always get latest), cache-first for assets
    if (e.request.mode === 'navigate' || e.request.url.endsWith('.html')) {
        e.respondWith(
            fetch(e.request).then(resp => {
                const clone = resp.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                return resp;
            }).catch(() => caches.match(e.request))
        );
    } else {
        e.respondWith(
            caches.match(e.request).then(cached => cached || fetch(e.request))
        );
    }
});
