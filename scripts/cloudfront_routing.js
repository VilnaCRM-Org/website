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
 * the tables beyond what the export actually ships.
 *
 * Security headers for real responses are owned by the viewer-response handler
 * (`scripts/cloudfront_security_headers.js`). A viewer-response function does NOT run when
 * a viewer-request function returns its own response, so every synthetic 404 this handler
 * returns — and after #383 that is every blocked path, not just unknown single-segment ones
 * — carries the same header set inline. Both copies are verified against the single source
 * of truth, `config/security-headers.json`, by `make lint-headers` (issue #377).
 */
'use strict';

var NOT_FOUND_BODY =
  '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 - Page Not Found</h1></body></html>';

var SECURITY_HEADERS = Object.freeze({
  'content-security-policy': "frame-ancestors 'none'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
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

var ROUTE_MAP = Object.freeze({
  '/': '/index.html',
  '/about': '/about/index.html',
  '/about/': '/about/index.html',
  '/en': '/en/index.html',
  '/en/': '/en/index.html',
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

function isAllowedAsset(uri) {
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
