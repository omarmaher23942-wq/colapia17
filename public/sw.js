/* Service worker: أصول ثابتة من الذاكرة أولاً، والصفحات من الشبكة أولاً مع صفحة عدم اتصال.
   لا يخزّن أي طلب API أو دخول أو لوحة تحكم أو دفع أو طلبات غير GET. */
const VERSION = "v1";
const STATIC = "static-" + VERSION;
const PAGES = "pages-" + VERSION;
const OFFLINE = "/offline.html";
const PRIVATE = /^\/(api|dashboard|admin|login|logout|checkout|order|track|confirm|review|cart|start|follow|print|setup|auth)(\/|$)/;
const STATIC_PATH = /^\/(_next\/static|icons|brand|landing|demo)\/|\.(?:woff2?|css|js|png|jpe?g|webp|avif|svg|ico)$/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (PRIVATE.test(url.pathname) && req.mode !== "navigate") return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !PRIVATE.test(url.pathname)) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          if (!PRIVATE.test(url.pathname)) {
            const hit = await caches.match(req);
            if (hit) return hit;
          }
          return (await caches.match(OFFLINE)) || Response.error();
        })
    );
    return;
  }

  if (STATIC_PATH.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
      )
    );
  }
});
