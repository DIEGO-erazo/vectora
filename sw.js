/* Vectora — service worker: la versión web funciona sin conexión.
   · Archivos propios: primero la red (siempre la última versión) y, sin conexión, la copia guardada.
   · Librerías del CDN (versiones fijas, inmutables): primero la copia guardada. */
'use strict';
const VERSION = 'vectora-1.2.0';

self.addEventListener('install', e => e.waitUntil((async () => {
  const cache = await caches.open(VERSION);
  /* la lista de archivos se obtiene del propio index.html: no hay que mantenerla a mano */
  const html = await (await fetch('index.html', { cache: 'reload' })).text();
  const refs = [...html.matchAll(/(?:src|href)="([^"#:?]+)"/g)].map(m => m[1]);
  const urls = new Set(['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', ...refs]);
  await cache.addAll([...urls].map(u => new Request(u, { cache: 'reload' })));
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      try {
        /* no-cache: revalida con el servidor para no servir archivos viejos de la caché HTTP */
        const res = await fetch(req, { cache: 'no-cache' });
        if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
        return res;
      } catch (err) {
        return (await caches.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? caches.match('index.html') : Response.error());
      }
    })());
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith((async () => {
      const hit = await caches.match(req); if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') (await caches.open(VERSION)).put(req, res.clone());
      return res;
    })());
  }
});
