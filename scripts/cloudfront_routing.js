/**
 * ES5.1 compatible (no let/const/arrow functions).
 *
 * CloudFront Functions **viewer-request** handler. It is FAIL-CLOSED (issue #383): a URI
 * reaches the S3 origin only if it is an exact `ROUTE_MAP` route, an exact allow-listed
 * file, or lives under an allow-listed top-level directory AND carries an allow-listed
 * file extension. Everything else gets the synthetic site 404 instead of the origin.
 *
 * Before #383 this function was default-allow: any URI whose last path segment contained a
 * `.`, and any unknown multi-segment path, was passed straight through. `/secret.json`,
 * `/.env`, `/backup/db.sql` and `/*.map` all reached the bucket, so origin protection
 * rested entirely on the S3 bucket policy — and unmapped paths leaked S3's native
 * AccessDenied XML instead of this site's 404.
 *
 * The three tables below describe the static export in `out/`. They are proved COMPLETE on
 * every PR by `scripts/ci/verify-edge-allowlist.mjs`, which runs this handler over every
 * file of a freshly built export. If that gate fails, add the new path here — do NOT widen
 * the tables beyond what the export actually ships. `ROUTE_MAP` is additionally held to
 * `config/routes.json` (generated from `pages/`) and proved MINIMAL — every rewrite target
 * must be a file the export really writes — by that same gate (issue #333).
 *
 * Security headers for real responses are owned by the viewer-response handler
 * (`scripts/cloudfront_security_headers.js`). A viewer-response function does NOT run when
 * a viewer-request function returns its own response, so every synthetic 404 this handler
 * returns — and after #383 that is every blocked path, not just unknown single-segment ones
 * — carries the same header set inline. Both copies are verified against the single source
 * of truth, `config/security-headers.json`, by `make lint-headers` (issue #377).
 */
'use strict';

// The document a visitor sees for every blocked or unknown path. It is BRANDED and
// self-contained (issue #339): a viewer-request function returns a body, it cannot fetch
// one, so this string is the whole response — no stylesheet, no font, no script. Every rule
// is therefore inline, and the colours are the site's own (`#1A1C1E` is `darkPrimary` in
// src/components/ui-color-theme on the white ground the site uses), so the page reads as
// this site rather than as a storage error. That pair measures 16.8:1, well past the 4.5:1
// WCAG 2.1 AA needs, which matters because no stylesheet can arrive to correct it.
//
// It stays English-only on purpose. This handler runs before anything knows which of the
// site's two locale bundles the visitor would have been served, and negotiating
// `accept-language` here would put a parser in front of every 404 to translate one
// sentence. The link is what resolves that: `/` is served by the site itself, which applies
// its own locale.
//
// `pages/404.tsx` is the same content rendered inside the real site chrome, exported to
// `/404.html`. It is NOT what this handler serves, and the two are not required to match
// word for word: a viewer-request function can rewrite the URI or return a response, and a
// rewrite would serve that document with a `200` — the soft 404 that tells a crawler a
// mistyped address is a real page. `/404.html` reaches visitors as the S3 bucket's error
// document; this string is what CloudFront returns for everything the allow-list rejects.
var NOT_FOUND_BODY =
  '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<meta name="robots" content="noindex"><title>Page not found - VilnaCRM</title></head>' +
  '<body style="margin:0;background:#fff;color:#1A1C1E;' +
  "font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.5\">" +
  '<main style="box-sizing:border-box;margin:0 auto;max-width:34rem;padding:4rem 1.5rem;' +
  'text-align:center">' +
  '<h1 style="margin:0 0 1rem;font-size:1.75rem">This page does not exist</h1>' +
  '<p style="margin:0 0 2rem">The address may be mistyped, or the page may have been moved.</p>' +
  '<a href="/" style="color:#1A1C1E;font-weight:600">Back to the home page</a>' +
  '</main></body></html>';

var SECURITY_HEADERS = Object.freeze({
  'content-security-policy': "frame-ancestors 'none'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'permissions-policy':
    'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), usb=(), xr-spatial-tracking=()',
});

function buildNotFoundHeaders() {
  var headers = {
    'cache-control': { value: 'public, max-age=60' },
    'content-type': { value: 'text/html; charset=utf-8' },
  };
  var names = Object.keys(SECURITY_HEADERS);
  var i;

  for (i = 0; i < names.length; i++) {
    headers[names[i]] = { value: SECURITY_HEADERS[names[i]] };
  }

  return headers;
}

// The synthetic 404 is constructed in exactly one place: every blocked path must return the
// identical shape, and past incidents came from a response missing one field (#249 missing
// `body` -> 5xx, #235 missing `content-type` -> Safari downloaded the page). Routing it
// through buildNotFoundHeaders is also what keeps the security headers on the fail-closed
// 404s #383 added — a viewer-response function never runs for a response we return here.
function buildNotFoundResponse() {
  return {
    statusCode: 404,
    statusDescription: 'Not Found',
    headers: buildNotFoundHeaders(),
    body: NOT_FOUND_BODY,
  };
}

// Extensionless URLs the export serves, mapped to the object the export actually writes
// (issue #333). `next.config.js` leaves `trailingSlash` unset, so the export is FLAT — one
// `<route>.html` per route, `/` being the only route whose object is an `index.html`.
// Until #333 this table mapped `/about` and `/en` at `/about/index.html` and
// `/en/index.html`, neither of which the export has ever produced: there is no
// `pages/about`, and `pages/en/` holds only `docs/api.tsx`. Both curated routes therefore
// rewrote to a missing S3 key and leaked a raw storage error instead of the synthetic 404
// below, while `/en/docs/api` — the one route under `/en` that does ship — had no entry and
// was 404'd here. Every entry is now held to `config/routes.json`, which is generated from
// `pages/`, by `src/test/unit/routes/route-manifest.test.ts`, and every target is proved to
// exist in a real export by `scripts/ci/verify-edge-allowlist.mjs`.
// The manifest is deliberately the wider set: `/offline` is exported but intentionally not
// mapped, because the service worker precaches the fallback as `/offline.html`.
var ROUTE_MAP = Object.freeze({
  '/': '/index.html',
  '/en/docs/api': '/en/docs/api.html',
  '/en/docs/api/': '/en/docs/api.html',
  '/swagger': '/swagger.html',
  '/swagger/': '/swagger.html',
});

// Top-level directories of the static export that may serve files.
var ALLOWED_DIRS = Object.freeze({
  _next: true,
  en: true,
  images: true,
  layout: true,
});

// Exact paths served outside those directories. Root-level files are exact-matched rather
// than extension-matched so an unexported `/secret.json` cannot ride in on the legitimate
// `/swagger-schema.json`.
var ALLOWED_FILES = Object.freeze({
  // Shipped by the export today.
  '/404.html': true,
  '/favicon.svg': true,
  '/index.html': true,
  // The offline shell and the worker that precaches it (issue #338). Both are
  // root-level exports, and root-level files are exact-matched rather than
  // extension-matched, so these two entries are what publish them. Without
  // `/offline.html` the precache fetch takes the synthetic 404 and the worker falls back
  // to its inline 503 document; without `/sw.js` the registration itself 404s and no
  // worker is ever installed.
  '/offline.html': true,
  '/sw.js': true,
  '/supportUkraine.svg': true,
  '/swagger-schema.json': true,
  '/swagger.html': true,
  '/vercel.svg': true,
  // RFC 9116 disclosure policy (issue #383). `.well-known` is not an allowed directory and
  // `txt` is not an allowed extension, so this exact entry is what publishes it — which is
  // tighter than opening a `.well-known` prefix.
  '/.well-known/security.txt': true,
  // Not exported yet: the SEO surface ships with issue #339. Pre-seeded so that issue
  // cannot land a robots.txt/sitemap.xml this function silently 404s.
  '/robots.txt': true,
  '/sitemap.xml': true,
});

// Extensions the export actually ships. `json` is absent on purpose — the only exported
// .json is root-level and exact-matched above, so `/anything/x.json` is blocked. `map` must
// never be added: browser source maps are disabled (`productionBrowserSourceMaps` is unset,
// enforced by `make lint-prod-guardrails`) and publishing them would leak the sources.
var ALLOWED_EXTENSIONS = Object.freeze({
  css: true,
  html: true,
  ico: true,
  jpg: true,
  js: true,
  png: true,
  svg: true,
  webmanifest: true,
  webp: true,
  woff2: true,
  xml: true,
});

// Own-property lookup, so inherited names (`toString`, `constructor`, `__proto__`) can never
// be mistaken for an allow-listed entry.
function has(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key);
}

function firstSegment(uri) {
  var parts = uri.split('/');
  return parts.length > 1 ? parts[1] : '';
}

// `lastDot <= 0` covers "no dot at all"; the leading-dot test covers every dotfile,
// including one carrying a second dot (`/images/.env.js`), so dotfiles are never treated as
// carrying an extension.
function extensionOf(uri) {
  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
  var lastDot = lastSegment.lastIndexOf('.');
  if (lastDot <= 0 || lastSegment.charAt(0) === '.') {
    return '';
  }
  return lastSegment.substring(lastDot + 1).toLowerCase();
}

// CloudFront hands this function the URI still percent-encoded and it never normalises
// dot segments, so both are checks the tables above cannot make for themselves.
// `/images/%2Eenv.js` has a last segment starting with `%`, not `.`, so `extensionOf` reads
// a plain `js` and the dotfile test never fires — yet S3 percent-decodes the path to derive
// the object key and serves `images/.env.js`. `%2F` is worse still: it moves where the last
// segment even begins (`/images/a%2F.env.js` -> `images/a/.env.js`). Decoding here would
// need its own try/catch, because decodeURIComponent throws on a malformed escape like
// `%zz` and a throw inside this handler is caught below and FAILS OPEN, so the whole
// escaped family is rejected outright instead. Nothing in the static export carries a `%`
// in its name — `scripts/ci/verify-edge-allowlist.mjs` proves that on every PR — so this
// costs the site nothing. A `.` or `..` segment is rejected for the same reason: it
// satisfies the directory and extension tests while resolving somewhere else entirely.
function isUnsafeUri(uri) {
  var parts = uri.split('/');
  var i;

  for (i = 0; i < parts.length; i++) {
    if (parts[i] === '.' || parts[i] === '..') {
      return true;
    }
  }

  return uri.indexOf('%') !== -1;
}

function isAllowedAsset(uri) {
  if (isUnsafeUri(uri)) {
    return false;
  }
  if (has(ALLOWED_FILES, uri)) {
    return true;
  }
  if (!has(ALLOWED_DIRS, firstSegment(uri))) {
    return false;
  }
  return has(ALLOWED_EXTENSIONS, extensionOf(uri));
}

function handler(event) {
  var request = event.request;

  if (!request || typeof request.uri !== 'string') {
    var host =
      (request && request.headers && request.headers.host && request.headers.host.value) || '';
    console.log(
      'cloudfront_routing: missing/invalid request.uri',
      'host=',
      host,
      'uri=',
      request && request.uri
    );
    return request;
  }

  try {
    var uri = request.uri;

    if (has(ROUTE_MAP, uri)) {
      request.uri = ROUTE_MAP[uri];
      return request;
    }

    if (isAllowedAsset(uri)) {
      return request;
    }

    return buildNotFoundResponse();
  } catch (err) {
    // A bug in this handler must never black-hole the site: fall back to the origin.
    console.log('cloudfront_routing: error', err);
    return request;
  }
}
