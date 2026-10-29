// Cached nur die App-Hülle: Anmeldeseite, Manifest, Icons und statische Next-Assets. Keine API-/Nutzerdaten.
// "/" liegt hinter dem Route-Schutz (Weiterleitung auf /login); eine weitergeleitete Antwort darf der Worker nicht für Navigationen ausliefern.
const CACHE = "shell-v1";
const SHELL = ["/login", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

// Die Seite hat ihre JS/CSS-Dateien schon geladen, bevor der Worker aktiv wird: aus dem HTML nachholen.
async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  const html = await (await cache.match("/login")).text();
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) ?? [])];
  await cache.addAll(assets);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Netzwerk zuerst, offline die zwischengespeicherte Hülle.
    event.respondWith(fetch(request).catch(() => caches.match("/login")));
  } else if (url.pathname.startsWith("/_next/static/") || SHELL.includes(url.pathname)) {
    // Unveränderliche, gehashte Assets: Cache zuerst, beim ersten Treffer nachladen.
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});
