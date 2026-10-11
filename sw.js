/* Caderno do Professor — guarda o app no aparelho para funcionar sem internet (iPhone / navegador).
   Mude o nome do cache a cada versão para os aparelhos baixarem os arquivos novos. */
const CACHE = 'caderno-prof-v0.5';
const ARQUIVOS = ['./', 'index.html', 'style.css', 'app.js', 'logo.webp', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Responde do aparelho na hora e, se houver internet, atualiza a cópia guardada para a próxima abertura.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const guardado = await cache.match(e.request, { ignoreSearch: true });
    const daRede = fetch(e.request).then(r => {
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    }).catch(() => guardado);
    return guardado || daRede;
  }));
});
