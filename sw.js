const CACHE = "vkast-v3";

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.add("/")).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Supabase API en Edge Functions: altijd netwerk, nooit cachen
  if (url.hostname.endsWith("supabase.co")) return;

  // Hashed assets (bijv. /assets/index-Abc123.js): cache-first (hash = uniek per build)
  if (/\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?)/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }))
    );
    return;
  }

  // Navigatie (index.html): network-first zodat deploys direct actief zijn; cache als offline-fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
