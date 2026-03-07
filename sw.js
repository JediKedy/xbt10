// ── XBT-10 Service Worker (v2.1) ──────────────────────────────────────────
const VERSION = 'v2.1';
const CACHE_NAME = `xbt10-shell-${VERSION}`;
const DATA_CACHE = `xbt10-data-${VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './data.json', // Yerli data faylı precache-ə əlavə olundu
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/vue@3/dist/vue.global.prod.js', // Prod versiya
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap',
];

// ── Install: Shell resurslarını keşlə ─────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // Yeni versiyanı dərhal aktivləşdir
  );
});

// ── Activate: Köhnə keşləri təmizlə ────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME && key !== DATA_CACHE) {
          return caches.delete(key);
        }
      })
    )).then(() => self.clients.claim())
  );
});

// ── Fetch: Strategiyalar ──────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Data faylı (data.json) üçün: Network First
  if (url.pathname.endsWith('data.json')) {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
    return;
  }

  // 2. Google Fonts üçün: Stale-While-Revalidate
  if (url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('fonts.googleapis.com')) {
    event.respondWith(staleWhileRevalidate(event.request, CACHE_NAME));
    return;
  }

  // 3. Digər hər şey (HTML, CSS, JS): Cache First
  event.respondWith(cacheFirst(event.request, CACHE_NAME));
});

// ── Strategiya Funksiyaları ───────────────────────────────────────────────

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cachedResponse = await cache.match(request);
    return cachedResponse || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok || networkResponse.type === 'opaque') {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok || networkResponse.type === 'opaque') {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  return cachedResponse || fetchPromise;
}

// Mesaj vasitəsilə yenilənmə (İstəyə bağlı)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});