/**
 * ES5.1 compatible (no let/const/arrow functions).
 *
 * CloudFront Functions **viewer-response** handler. It attaches the repository's
 * security-header policy to every response CloudFront runs it for — every page and every
 * asset (issue #377).
 *
 * KNOWN GAP: CloudFront does NOT run a viewer-response function when the origin returns an
 * HTTP status of 400 or higher ("If the origin returns an HTTP error of 400 and above, the
 * CloudFront Function will not run" — CloudFront Functions event structure / edge-function
 * restrictions). S3 4xx/5xx bodies for paths this repo's routing function passes through
 * therefore do not get the policy from here. A CloudFront **response headers policy**
 * carrying the same values covers those too; see docs/security-headers.md.
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
