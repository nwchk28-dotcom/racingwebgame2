/* Scope-relative URLs work on both GitHub Pages project sites and localhost. */
const CACHE = 'apex-one-webapp-v3';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([
    './', './manifest.webmanifest?v=formula-q-3', './app-192.png', './app-512.png',
  ])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('apex-one-webapp-') && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Refresh install metadata as well as HTML; never pin an old app name.
    const navigation = request.mode === 'navigate';
    const metadata = /\/(manifest\.webmanifest|app-(180|192|512)\.png)$/.test(url.pathname);
    if (navigation || metadata) {
      try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || (navigation ? await cache.match('./') : undefined) || Response.error();
      }
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && !request.headers.has('range')) await cache.put(request, response.clone());
    return response;
  })());
});
