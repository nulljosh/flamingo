// Offline: keep the app shell and the map data; refresh them in the background.
const C = "flamingo-v1", SHELL = ["/app/", "/app/app.css?v=1", "/app/app.js?v=1", "/app/search.js", "/data/leonida.json", "/icon.svg"]
self.addEventListener("install", e => e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())))
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())))
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url)
  if (e.request.method !== "GET" || u.origin !== location.origin) return
  e.respondWith(caches.open(C).then(async c => {
    const hit = await c.match(e.request), net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r }).catch(() => hit)
    return hit || net
  }))
})
