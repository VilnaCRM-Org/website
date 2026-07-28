/**
 * ES5.1 compatible (no let/const/arrow functions).
 *
 * CloudFront Functions **viewer-response** handler. It attaches the repository's
 * security-header policy to EVERY response CloudFront returns — pages, assets, and
 * origin errors alike (issue #377).
 *
 * The static export (`output: 'export'` in next.config.js) makes Next's `headers()`
 * a no-op, so the edge is the only enforcement point available to this repo. Associate
 * this function with the distribution's default cache behaviour on the
 * `viewer-response` event type; `scripts/cloudfront_routing.js` stays on
 * `viewer-request`.
 *
 * A viewer-response function does NOT run when a viewer-request function short-circuits
 * with its own response, so the synthetic 404 in `scripts/cloudfront_routing.js` carries
 * the same header set inline. Both copies are verified against the single source of
 * truth, `config/security-headers.json`, by `make lint-headers`.
 *
 * Values are set (not merged) so an origin response can never weaken or drop a header.
 */
'use strict';

var SECURITY_HEADERS = Object.freeze({
  'content-security-policy': "frame-ancestors 'none'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
});

var SECURITY_HEADER_NAMES = Object.freeze(Object.keys(SECURITY_HEADERS));

function applySecurityHeaders(headers) {
  var i;
  for (i = 0; i < SECURITY_HEADER_NAMES.length; i++) {
    headers[SECURITY_HEADER_NAMES[i]] = { value: SECURITY_HEADERS[SECURITY_HEADER_NAMES[i]] };
  }
  return headers;
}

function handler(event) {
  var response = event.response;

  if (!response || typeof response !== 'object') {
    console.log('cloudfront_security_headers: missing/invalid response', 'response=', response);
    return response;
  }

  try {
    if (!response.headers) {
      response.headers = {};
    }

    applySecurityHeaders(response.headers);

    return response;
  } catch (err) {
    // Fail open: a throwing viewer-response function turns every request into a 502,
    // which is a worse outcome than one response missing its headers. The log surfaces
    // the breakage in the function's CloudWatch metrics.
    console.log('cloudfront_security_headers: error', err);
    return response;
  }
}
