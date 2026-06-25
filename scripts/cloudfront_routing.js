/**
 * ES5.1 compatible (no let/const/arrow functions).
 */
'use strict';

var NOT_FOUND_BODY = '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 - Page Not Found</h1></body></html>';

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
        headers: {
          'cache-control': { value: 'public, max-age=60' },
          'content-type': { value: 'text/html; charset=utf-8' },
        },
        body: NOT_FOUND_BODY
      };
    }

    return request;
  } catch (err) {
    console.log('cloudfront_routing: error', err);
    return request;
  }
}
