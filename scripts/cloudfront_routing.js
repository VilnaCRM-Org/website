/**
 * This script follows ES5.1 rules for compatibility.
 * Avoid ES6+ syntax (e.g., `let`, `const`, arrow functions).
 */
'use strict';
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

  if (!request.uri || typeof request.uri !== 'string') {
    var host = (request.headers && request.headers.host && request.headers.host.value) || '';
    console.log(
      'cloudfront_routing: missing/invalid request.uri',
      'host=',
      host,
      'uri=',
      request.uri
    );
    return request;
  }

  try {
    var uri = request.uri;
    if (Object.prototype.hasOwnProperty.call(ROUTE_MAP, uri)) {
      request.uri = ROUTE_MAP[uri];
      return request;
    } else {
      var segments = uri.split('/');
      var lastSegment = segments[segments.length - 1];
      if (lastSegment.indexOf('.') === -1 && segments.length > 2) {
        request.uri = uri + '/index.html';
        return request;
      }
    }

    var lastChar = typeof uri === 'string' ? uri.charAt(uri.length - 1) : '';
    if (lastChar === '/') {
      request.uri = uri + 'index.html';
      return request;
    } else if (lastSegment.indexOf('.') === -1 && segments.length > 2) {
      request.uri = uri + '/index.html';
      return request;
    }

    return request;
  } catch (error) {
    console.log('cloudfront_routing: error', error);
    return request;
  }
}
