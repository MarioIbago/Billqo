const VERSION = 'billqo-pwa-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const CORE_URLS = [
  '/',
  '/app/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
];

async function fetchAndCache(cache, url) {
  try {
    const response = await fetch(new Request(url, { cache: 'reload' }));
    if (response.ok && response.type === 'basic') await cache.put(url, response.clone());
    return response;
  } catch {
    return undefined;
  }
}

async function warmAppShell() {
  const cache = await caches.open(SHELL_CACHE);
  const indexResponse = await fetchAndCache(cache, '/index.html');
  const urls = new Set(CORE_URLS);

  if (indexResponse) {
    try {
      const html = await indexResponse.clone().text();
      for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
        const value = match[1];
        if (value.startsWith('/assets/')) urls.add(value);
      }
    } catch {
      // The core shell is still useful even if asset discovery fails.
    }
  }

  await Promise.allSettled([...urls].map((url) => fetchAndCache(cache, url)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(warmAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith('billqo-pwa-') && ![SHELL_CACHE, RUNTIME_CACHE].includes(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function offlineDocument() {
  const cache = await caches.open(SHELL_CACHE);
  return (await cache.match('/index.html'))
    || (await cache.match('/app/'))
    || new Response(
      '<!doctype html><html lang="es-MX"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#050505"><body style="margin:0;background:#050505;color:white;font:16px system-ui;display:grid;min-height:100vh;place-items:center"><p>Billqo está sin conexión. Abre la app una vez con internet para completar la instalación offline.</p></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
}

async function networkFirstDocument(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    return offlineDocument();
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Authenticated API responses are deliberately never cached. This avoids
  // leaking finance data between sessions and prevents hidden API/Firebase
  // retries from the service worker while offline.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  if (
    url.pathname.startsWith('/assets/')
    || url.pathname === '/favicon.svg'
    || url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(cacheFirstStatic(request));
  }
});
