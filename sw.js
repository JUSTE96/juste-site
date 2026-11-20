// JusteCV — service worker : réseau d'abord, copie gardée en secours quand il n'y a pas de connexion.
const CACHE = "justecv-v1";
const SOCLE = ["./", "atelier.html", "modeles.html", "suivi.html", "guides.html", "juste.css?v=5", "pages.css?v=9", "nuit.css?v=3", "nuit.js?v=3", "appli.js?v=1", "assets/icones.svg",
  "fonts/lora-latin-wght-normal.woff2", "fonts/schibsted-grotesk-latin-wght-normal.woff2"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SOCLE)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then((rep) => { if (rep.ok) { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put(r, copie)); } return rep; })
    .catch(() => caches.match(r, { ignoreSearch: r.mode === "navigate" }).then((rep) => rep || (r.mode === "navigate" ? caches.match("atelier.html") : Response.error()))));
});
