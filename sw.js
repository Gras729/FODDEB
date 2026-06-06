/* ============================================================
   FODDEB — Service Worker (sw.js)
   Stratégie : Cache First pour assets, Network First pour HTML
   ============================================================ */

const CACHE_NAME    = 'foddeb-v2.1.0'; // Bump pour forcer le remplacement de l'ancien SW cassé
const RUNTIME_CACHE = 'foddeb-runtime-v2';

// Uniquement les fichiers CERTAINS d'exister — addAll() échoue si UN seul manque
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/main.css',
  '/assets/js/services/api.js',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
];

/* Domaines externes à ne JAMAIS intercepter */
const BYPASS_HOSTNAMES = [
  'script.google.com',
  'script.googleusercontent.com', // URL de redirection GAS — important
  'fedapay.com',
  'google.com',
  'googleapis.com',
  'gstatic.com',
  'recaptcha.net',
  'www.google.com',
];

/* ---- Install : pré-cache robuste ---- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        // addOne par un — un 404 ne casse pas tout le cache
        Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

/* ---- Activate : nettoyage des anciens caches ---- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---- Fetch : stratégie hybride ---- */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas intercepter : non-GET, domaines externes, requêtes API
  if (
    request.method !== 'GET' ||
    url.hostname !== self.location.hostname ||
    BYPASS_HOSTNAMES.some(h => url.hostname.includes(h))
  ) return;

  /* Assets statiques → Cache First */
  if (
    url.pathname.startsWith('/assets/') ||
    /\.(css|js|png|jpg|jpeg|svg|webp|woff2?|ico)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(c => c.put(request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  /* Pages HTML → Network First avec fallback cache */
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            caches.open(RUNTIME_CACHE).then(c => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match('/index.html'))
        )
    );
    return;
  }
});

/* ---- Push notifications ---- */
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'FODDEB', {
      body:  data.body  || '',
      icon:  '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/icon-192x192.png',
      tag:   data.tag   || 'foddeb-notif',
      data:  data.url   || '/'
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data));
});
