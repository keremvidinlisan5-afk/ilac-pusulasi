// İlaç Pusulası service worker: her şey telefonda saklanır, internetsiz de açılır.
// Veri ya da sayfa güncellenince SURUM'u artır; eski önbellek silinir.
const SURUM = "v1";
const ONBELLEK = "ilac-pusulasi-" + SURUM;
const DOSYALAR = [
  "./",
  "index.html",
  "veri.gz.txt",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(ONBELLEK).then(c => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith("ilac-pusulasi-") && k !== ONBELLEK).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts: önbellekten, yoksa ağdan alıp sakla
  if (url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.open(ONBELLEK).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      c.put(req, res.clone());
      return res;
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // Kendi dosyalarımız: anında önbellekten ver, arka planda tazele
  e.respondWith(caches.open(ONBELLEK).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await c.match("index.html") : null);
    // büyük veri dosyası her açılışta yeniden inmesin; SURUM değişince yenilenir
    if (hit && url.pathname.endsWith("veri.gz.txt")) return hit;
    const ag = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(ag); return hit; }
    return (await ag) || new Response("Çevrimdışı", { status: 503 });
  }));
});
