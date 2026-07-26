/*
 * sw.js — Service worker: cachea la app completa para que funcione
 * sin conexión una vez visitada.
 *
 * Estrategia "caché primero, revalidar detrás": se responde al instante
 * desde la caché y en segundo plano se descarga la versión nueva de
 * cada archivo, que queda lista para la siguiente visita. Así los
 * cambios publicados en GitHub Pages llegan solos (a la segunda visita)
 * sin necesidad de tocar el número de versión de la caché.
 */
const CACHE = 'synapsis-v1';

/* Todo lo necesario para jugar sin conexión (rutas relativas al ámbito
   del service worker, que en GitHub Pages es /synapsis/). */
const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/utils.js',
  'js/difficulty.js',
  'js/storage.js',
  'js/registry.js',
  'js/poly.js',
  'js/generators/matrix.js',
  'js/generators/series.js',
  'js/generators/rotation.js',
  'js/generators/lines.js',
  'js/generators/puzzle.js',
  'js/generators/assembly.js',
  'js/generators/cutout.js',
  'js/main.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(
        claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  evento.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const guardada = await cache.match(evento.request);
      const red = fetch(evento.request)
        .then((respuesta) => {
          if (respuesta && respuesta.ok) cache.put(evento.request, respuesta.clone());
          return respuesta;
        })
        .catch(() => guardada); // sin red: lo que haya en caché
      return guardada || red;
    })
  );
});
