// AnyTerm Service Worker — enables PWA install + offline fallback
const CACHE_NAME = 'anyterm-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Network-first: try network, fall back to cache, then offline message
self.addEventListener('fetch', (event) => {
  // Don't cache WebSocket or API requests
  if (event.request.url.includes('/ws/') || event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) =>
          cached || new Response(
            '<!DOCTYPE html><html><body style="background:#1a1b26;color:#c0caf5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>AnyTerm Offline</h1><p>Server is unreachable. Check your connection.</p></div></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html' } }
          )
        )
      )
  );
});
