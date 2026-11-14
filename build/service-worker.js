/* These two values are replaced by the production build. */
const VERSION = "__VERSION__";
const ASSETS = "__ASSETS__";
const PREFIX = `rezsipont:${self.registration.scope}:`;
const CACHE = PREFIX + VERSION;
const urls = ASSETS.map((path) => new URL(path, self.registration.scope).href);
const known = new Set(urls);

self.addEventListener("install", (event) => {
  // Activation is all-or-nothing. A failed download leaves the previous app
  // version working; partial caches must never be advertised as offline-ready.
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        await cache.addAll(
          urls.map((url) => new Request(url, { cache: "reload" })),
        );
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
    })(),
  );
  // Do not skipWaiting: replacing a running version can break lazy imports or
  // interrupt unsaved edits. Updates activate after all old windows are closed.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  url.search = "";
  url.hash = "";
  if (url.href === self.registration.scope) url.pathname += "index.html";
  if (!known.has(url.href)) return;
  // Every app resource is local. Only browser-managed app update checks need
  // the network. Query parameters do not create separate offline copies.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const response = await cache.match(url.href);
      return response ?? Response.error();
    }),
  );
});
