// PrintMagic Studio PWA Offline Service Worker
const CACHE_NAME = 'printmagic-v3.4.0-offline';

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
      }).catch(() => {
        // If navigating and offline, return cached index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./');
        }
      });
    })
  );
});
