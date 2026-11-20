/* NutriSnap – Dienst-Worker: App startet auch ohne Netz, Updates kommen automatisch, sobald Netz da ist. */
const V = 'ns-shell-v19';
const PH = 'ns-photos-v1';
const FILES = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'apple-touch-icon.png', 'zxing.min.js', 'fotos.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf('ns-shell-') === 0 && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method === 'GET' && u.hostname === 'upload.wikimedia.org') {   /* freie Rezeptfotos: einmal laden, danach auch offline */
    e.respondWith(caches.open(PH).then(async c => {
      const hit = await c.match(r.url); if (hit) return hit;
      try { const net = await fetch(r); if (net && (net.ok || net.type === 'opaque')) c.put(r.url, net.clone()); return net; }
      catch (err) { return new Response('', {status: 504}); }
    }));
    return;
  }
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.indexOf('/_blob/') >= 0) {            /* lokal gespeicherte Rezeptbilder */
    e.respondWith(caches.open('ns-blobs').then(c => c.match(r.url)).then(m => m || new Response('', {status: 404})));
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(V);
    try {
      const net = await Promise.race([fetch(r), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), u.pathname.endsWith('fotos.js') ? 90000 : 5000))]);
      if (net && net.ok) cache.put(r, net.clone());
      return net;
    } catch (err) {
      const hit = await cache.match(r, {ignoreSearch: true});
      if (hit) return hit;
      if (r.mode === 'navigate') { const i = await cache.match('index.html'); if (i) return i; }
      return fetch(r);
    }
  })());
});
