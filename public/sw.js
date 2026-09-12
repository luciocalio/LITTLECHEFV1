// public/sw.js — Service worker minimo per installabilità PWA (Stage 10, Punto 2).
// NESSUNA cache, NESSUNA logica offline: ogni richiesta passa dritta alla
// rete, esattamente come senza service worker. Non deve MAI intercettare o
// alterare le chiamate a Supabase o a /api/chat — qui non succede perché il
// fetch handler si limita a ripassare la richiesta invariata alla rete.
// Il comportamento offline vero è un miglioramento futuro separato.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
