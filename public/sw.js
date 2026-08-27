/**
 * WrapShop OS service worker.
 *
 * Minimal by design — Next 16 uses Turbopack which doesn't yet play nicely
 * with Serwist/Workbox webpack integrations, so we hand-roll the SW.
 *
 * Strategy:
 *   • Cache the offline shell + app icons at install time.
 *   • Everything else goes network-first. If the network fails on a document
 *     request, fall back to `/offline`. Non-document failures propagate
 *     normally so callers can show their own state.
 *   • Never cache API responses. Multi-tenant leakage risk if a cached
 *     response served the wrong user.
 *
 * TODO(stretch:pwa.background-sync): opt-in background-sync queue for
 * conflict-safe mutations (checklist toggles, photo uploads, time punches,
 * note appends) via a manual IndexedDB queue. See plan §2.11.
 */

const CACHE = "wrapshop-shell-v1";
const OFFLINE_URL = "/offline";
const PRECACHE = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GETs; POST/PUT/DELETE must not touch the SW cache — they can
  // include tenant-scoped data.
  if (req.method !== "GET") return;

  // Never touch API traffic or auth-callback traffic.
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/auth/")) return;

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  // For document requests, network-first with offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(req);
          return network;
        } catch {
          const cache = await caches.open(CACHE);
          const cached = await cache.match(OFFLINE_URL);
          return cached ?? new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // For pre-cached static assets, serve from cache if present.
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);
        return cached ?? fetch(req);
      })(),
    );
  }
});
