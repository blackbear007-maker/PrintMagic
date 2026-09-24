// PrintMagic Studio PWA Offline Service Worker
// Bumped 2026-09-24: activating this version deletes the old cache, which held a stale index.html.
const CACHE_NAME = 'printmagic-v3.6.0-offline';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './xiaoxiang.jpg',
  './brand/logo-mark.svg',
  './textures/paper.webp',
  './textures/ink-wash.webp',
  './brand/logo-mark-64.png',
  './brand/logo-mark-192.png',
  './brand/logo-mark-512.png',
  './brand/apple-touch-icon.png',
  './xiaoxiang/idle.webp',
  './xiaoxiang/idle-blink.webp',
  './xiaoxiang/hello.webp',
  './xiaoxiang/hello-blink.webp',
  './xiaoxiang/think.webp',
  './xiaoxiang/think-blink.webp',
  './xiaoxiang/thumbs.webp',
  './xiaoxiang/thumbs-blink.webp',
  './xiaoxiang/cheer.webp',
  './xiaoxiang/cheer-blink.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Some Google-generated expressions may arrive in a later quota window.
      // Missing optional assets must not prevent the PWA shell from installing.
      return Promise.all(ASSETS_TO_CACHE.map((asset) => cache.add(asset).catch(() => undefined)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Exclude external APIs or cloud server calls
  if (url.port === '3001' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Pages: network-first, cache only as the offline fallback. Serving index.html cache-first meant
  // every visit after a deploy loaded the PREVIOUS build (the new one only arrived one visit later),
  // so a shipped fix didn't reach users the first time they opened the app.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      }).catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to revalidate cache if online
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {
          // Ignore network errors when offline
        });
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
