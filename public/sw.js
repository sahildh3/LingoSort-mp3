const CACHE_NAME = 'lingosort-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Simple fetch-through strategy for PWA installability
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
