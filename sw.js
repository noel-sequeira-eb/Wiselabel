// Wiselabel service worker: keeps the app itself available offline.
const CACHE = "wiselabel-v5";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png",
  "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Live product data always comes from the network.
  if (url.hostname === "api.nal.usda.gov" || url.hostname === "api.edamam.com" || url.hostname === "api.spoonacular.com" || url.pathname.startsWith("/cgi/") || (/open(food|beauty)facts\.org$/.test(url.hostname) && url.pathname.startsWith("/api/"))) return;

  // The app page: try the network first so updates arrive, fall back to the saved copy offline.
  if (req.mode === "navigate" || (url.origin === location.origin && url.pathname.endsWith(".html"))) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // Everything else (icons, fonts, libraries, product photos): saved copy first, then network.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
