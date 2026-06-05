/* ============================================================
   FODDEB — Service Worker (sw.js)
   Stratégie : Cache First pour assets, Network First pour HTML
   Push notifications prêtes, runtime cache séparé
   ============================================================ */

const CACHE_NAME    = 'foddeb-v2.0.0';
const RUNTIME_CACHE = 'foddeb-runtime-v2';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/assets/css/main.css',
  '/assets/js/app.js',
  '/assets/js/utils.js',
  '/assets/js/services/api.js',
  '/assets/js/services/auth.js',
  /* Icônes PWA */
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/favicon-16x16.png',
  '/assets/icons/favicon-32x32.png',
  '/assets/icons/favicon-48x48.png',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-256x256.png',
  '/assets/icons/icon-512x512.png',
  '/assets/icons/maskable-icon-512x512.png',
  '/assets/icons/icon-72.png',
  '/assets/icons/icon-96.png',
  '/assets/icons/icon-128.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

/* Domaines externes à ne jamais intercepter */
const BYPASS_HOSTNAMES = [
  'script.google.com',
  'fedapay.com',
  'google.com',
  'googleapis.com',
  'gstatic.com',
  'recaptcha.net'
];

/* ---- Install : pré-cache des ressources statiques ---- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ---- Activate : nettoyage des anciens caches ---- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ---- Fetch : stratégie hybride ---- */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* Ne pas intercepter : requêtes externes (paiement, API, CAPTCHA) ou non-GET */
  if (
    request.method !== 'GET' ||
    BYPASS_HOSTNAMES.some(h => url.hostname.includes(h))
  ) return;

  /* Assets statiques → Cache First */
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(css|js|png|jpg|jpeg|svg|webp|woff2?|ico)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  /* Pages HTML → Network First avec fallback cache puis offline.html */
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request)
            .then(cached => cached || caches.match('/offline.html'))
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
      badge: '/assets/icons/icon-96.png',
      tag:   data.tag   || 'foddeb-notif',
      data:  data.url   || '/'
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data));
});
