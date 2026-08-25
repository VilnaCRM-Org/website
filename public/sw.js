/**
 * Offline shell service worker (issue #338).
 *
 * `site.webmanifest` declares `display: "standalone"`, which promises a launchable app
 * window. Without a worker that promise breaks the moment the network does: the OS opens
 * the installed app straight onto the browser's network-error page, in a window with no
 * address bar to escape from. This worker keeps the promise with the smallest surface that
 * can — one precached document, served only for a same-origin navigation the network
 * refused.
 *
 * Deliberately NOT a caching layer. Nothing is written to the cache at runtime, and every
 * request that is not a same-origin navigation returns before `respondWith`, so the browser
 * handles it exactly as if no worker were installed. That is what keeps the Playwright
 * `page.route` mocks and the Mockoon-backed e2e stack observing real requests, and what
 * stops a stale build being served after a deploy.
 *
 * Written entirely through `globalThis` member access: the repo's airbnb config lints
 * `public/` too, where bare `self`/`addEventListener` are `no-restricted-globals` errors and
 * `clients`/`skipWaiting` are `no-undef` errors. Suppressing either is banned and the member
 * form is equivalent inside a worker.
 */

// Bump whenever the precache set changes; `activate` then evicts every other generation.
// Every cache this worker owns starts with this prefix, so `activate` can evict
// its own stale generations without touching Cache Storage entries that another
// same-origin feature may own — the whole origin shares one CacheStorage.
const CACHE_PREFIX = 'vilnacrm-offline-';
const CACHE = `${CACHE_PREFIX}v1`;

// Reached as `.html` on purpose. The CloudFront edge function
// (`scripts/cloudfront_routing.js`) hard-404s an extensionless single-segment path, so
// `/offline` is not routable, while a last path segment containing a dot passes straight
// through. The worker only ever serves this from cache inside `respondWith`, so the address
// bar keeps the URL the visitor actually asked for.
const OFFLINE_URL = '/offline.html';

// Last resort for the window where the worker is live but the precache is not: `install`
// precached nothing (the cache then stays empty until the script bytes change and the
// browser reinstalls), or the user agent evicted the entry under storage pressure.
// `respondWith` treats a missing response as a network error, which would surface the very
// browser error page this worker exists to replace.
const OFFLINE_FALLBACK_HTML =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<title>Offline</title></head>' +
  '<body><h1>You are offline</h1></body></html>';

function offlineShell() {
  // Anchored to this worker's own cache for the same reason `activate` only evicts its own
  // prefix: the whole origin shares one CacheStorage, and an unscoped `caches.match` resolves
  // with the first hit in creation order — another same-origin owner's copy of
  // `/offline.html` would win over the one this worker precached. A missing cache resolves
  // undefined, so the 503 fallback still covers the empty-precache/evicted window.
  return globalThis.caches.match(OFFLINE_URL, { cacheName: CACHE }).then(
    cached =>
      cached ??
      new globalThis.Response(OFFLINE_FALLBACK_HTML, {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
  );
}

function isSameOriginNavigation(request) {
  return (
    request.mode === 'navigate' &&
    new globalThis.URL(request.url).origin === globalThis.location.origin
  );
}

globalThis.addEventListener('install', event => {
  // Exactly one URL is precached. Hashed `_next/static` chunk names change every build, so
  // precaching them would guarantee a permanently stale entry the very next deploy.
  // `cache: 'reload'` bypasses the HTTP cache so a redeploy never precaches a stale shell.
  event.waitUntil(
    globalThis.caches
      .open(CACHE)
      .then(cache => cache.add(new globalThis.Request(OFFLINE_URL, { cache: 'reload' })))
      // A failed precache must not fail the install: a rejected `waitUntil` discards the
      // installing worker, which leaves the browser's own network-error page in an
      // address-bar-less standalone window — exactly what this worker exists to replace.
      // The worker activates with an empty cache and serves OFFLINE_FALLBACK_HTML until a
      // later generation reinstalls it.
      .catch(() => undefined)
      .then(() => globalThis.skipWaiting())
  );
});

globalThis.addEventListener('activate', event => {
  event.waitUntil(
    globalThis.caches
      .keys()
      .then(keys =>
        globalThis.Promise.all(
          keys
            .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
            .map(key => globalThis.caches.delete(key))
        )
      )
      .then(() => globalThis.clients.claim())
  );
});

globalThis.addEventListener('fetch', event => {
  // Returning before `respondWith` hands the request back to the browser untouched. Every
  // subresource (XHR, fetch, chunks, images) and every cross-origin navigation — the footer
  // policy links point at github.com — takes this path.
  if (!isSameOriginNavigation(event.request)) {
    return;
  }

  // Network-first, cache-never: a working network always wins and no runtime response is
  // ever stored, so the shell can only ever appear when the navigation genuinely failed.
  event.respondWith(globalThis.fetch(event.request).catch(() => offlineShell()));
});
