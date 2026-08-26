/**
 * ES5.1 compatible (no let/const/arrow functions).
 *
 * CloudFront Functions **viewer-request** handler: it maps clean URLs onto the static
 * export's files and synthesises a 404 for unknown top-level paths.
 *
 * Security headers for real responses are owned by the viewer-response handler
 * (`scripts/cloudfront_security_headers.js`). A viewer-response function does NOT run when
 * a viewer-request function returns its own response, so the synthetic 404 below carries
 * the same header set inline. Both copies are verified against the single source of truth,
 * `config/security-headers.json`, by `make lint-headers` (issue #377).
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

var ROUTE_MAP = Object.freeze({
  '/': '/index.html',
  '/about': '/about/index.html',
  '/about/': '/about/index.html',
  '/en': '/en/index.html',
  '/en/': '/en/index.html',
  '/swagger': '/swagger.html',
  '/swagger/': '/swagger.html',
});

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

    if (Object.prototype.hasOwnProperty.call(ROUTE_MAP, uri)) {
      request.uri = ROUTE_MAP[uri];
      return request;
    }

    var lastSlash = uri.lastIndexOf('/');
    var lastSegment = uri.substring(lastSlash + 1);
    if (lastSegment.indexOf('.') !== -1) {
      return request;
    }

    var parts = uri.split('/');
    var segmentCount = parts.filter(Boolean).length;

    if (segmentCount === 1) {
      return {
        statusCode: 404,
        statusDescription: 'Not Found',
        headers: buildNotFoundHeaders(),
        body: NOT_FOUND_BODY,
      };
    }

    return request;
  } catch (err) {
    console.log('cloudfront_routing: error', err);
    return request;
  }
}
