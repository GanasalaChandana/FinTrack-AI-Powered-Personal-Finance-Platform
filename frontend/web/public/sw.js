// FinTrack Service Worker
// Strategy: Cache-first for static assets, offline fallback for pages, push notifications.
// API responses are never cached: they hold personal financial data that would stay in
// the browser after signing out.

const CACHE_VERSION = "fintrack-v2"; // v1 cached API responses; activating v2 deletes them
const STATIC_CACHE  = `${CACHE_VERSION}-static`;

// Pages / shells to precache on install
const PRECACHE_URLS = [
  "/",
  "/dashboard",
  "/offline",
];

// ── Install: precache shells ────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        // Some URLs may 404 (e.g., /offline doesn't exist yet) — ignore
      })
    )
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("fintrack-") && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: routing strategy ─────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, and cross-origin requests
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin && !url.pathname.startsWith("/api/")) return;

  // API requests: straight to the network, never cached (personal data)
  if (url.pathname.startsWith("/api/")) return;

  // Static assets (JS, CSS, images, fonts) → Cache-first
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf)$/) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML navigation → Network-first, offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match("/offline") || caches.match("/"))
      )
    );
    return;
  }
});

// ── Strategy helpers ────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

// ── Push notifications ──────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "FinTrack", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,               // a newer alert of the same kind replaces the older one
      data: { url: data.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only ever open FinTrack's own pages
  let target = new URL((event.notification.data && event.notification.data.url) || "/dashboard", self.location.origin);
  if (target.origin !== self.location.origin) target = new URL("/dashboard", self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          return w.navigate(target.href).then((c) => (c || w).focus());
        }
      }
      return self.clients.openWindow(target.href);
    })
  );
});
