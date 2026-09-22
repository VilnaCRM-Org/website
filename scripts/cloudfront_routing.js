/**
 * ES5.1 only (CloudFront Functions, cloudfront-js-1.0). Published to CloudFront verbatim
 * against a 10 KB function-size quota, so the rationale lives in docs/edge-routing.md, not
 * here. Fail-closed viewer-request handler (issue #383): a URI reaches the S3 origin only if
 * it is an exact ROUTE_MAP route, an exact ALLOWED_FILES entry, or sits under an
 * ALLOWED_DIRS directory with an ALLOWED_EXTENSIONS extension. Everything else gets the
 * synthetic 404 below.
 */
'use strict';

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

function buildNotFoundResponse() {
  return {
    statusCode: 404,
    statusDescription: 'Not Found',
    headers: buildNotFoundHeaders(),
    body: NOT_FOUND_BODY,
  };
}

// Held to config/routes.json and to a real export by the gates named in the docs.
var ROUTE_MAP = Object.freeze({
  '/': '/index.html',
  '/en': '/en.html',
  '/en/': '/en.html',
  '/en/docs/api': '/en/docs/api.html',
  '/en/docs/api/': '/en/docs/api.html',
  '/swagger': '/swagger.html',
  '/swagger/': '/swagger.html',
});

var ALLOWED_DIRS = Object.freeze({
  _next: true,
  en: true,
  images: true,
  layout: true,
});

// Root-level files are exact-matched, never extension-matched.
var ALLOWED_FILES = Object.freeze({
  '/404.html': true,
  '/en.html': true,
  '/favicon.svg': true,
  '/index.html': true,
  '/offline.html': true,
  '/sw.js': true,
  '/supportUkraine.svg': true,
  '/swagger-schema.json': true,
  '/swagger.html': true,
  '/vercel.svg': true,
  '/.well-known/security.txt': true,
  '/robots.txt': true,
  '/sitemap.xml': true,
  '/version.json': true,
});

// `json` is absent on purpose and `map` must never be added (see the docs).
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

function has(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key);
}

function firstSegment(uri) {
  var parts = uri.split('/');
  return parts.length > 1 ? parts[1] : '';
}

function extensionOf(uri) {
  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
  var lastDot = lastSegment.lastIndexOf('.');
  if (lastDot <= 0 || lastSegment.charAt(0) === '.') {
    return '';
  }
  return lastSegment.substring(lastDot + 1).toLowerCase();
}

// Percent-escapes and dot segments are rejected outright rather than decoded.
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
