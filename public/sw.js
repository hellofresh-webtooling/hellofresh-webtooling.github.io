const CACHE = "vkast-v2";

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

  // Navigatie en overige verzoeken: stale-while-revalidate (cache direct, netwerk update op achtergrond)
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        });
        return cached || fresh;
      })
    )
  );
});
