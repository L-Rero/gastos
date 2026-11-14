/* Service worker: guarda la app para que abra sin conexión. Nunca guarda datos del usuario
 * (las llamadas a Supabase no pasan por la caché). Cambia VERSION al publicar cambios. */
const VERSION = 'gastos-v6';
const ASSETS = ['./', 'index.html', 'app.css', 'config.js', 'manifest.webmanifest',
  'js/crypto.js', 'js/common.js', 'js/core.js', 'js/sync.js', 'js/pdfparse.js', 'js/ui.js', 'js/setup.js',
  'vendor/chart.umd.min.js', 'vendor/supabase.js', 'vendor/pdf.min.js', 'vendor/pdf.worker.min.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // la página: primero red (para recibir versiones nuevas), si no hay conexión, la copia guardada
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).catch(() => caches.match('index.html'))); return; }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
