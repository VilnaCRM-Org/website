/**
 * ES5.1 compatible (no let/const/arrow functions).
 */
'use strict';

var ROUTE_MAP = Object.freeze({
    '/': '/index.html',
    '/about': '/about/index.html',
    '/about/': '/about/index.html',
    '/en': '/en/index.html',
    '/en/': '/en/index.html',
    '/swagger': '/swagger.html'
});

/**
 * 1) Single source of truth: allowed paths are simply the keys of ROUTE_MAP.
 * 2) We use the array to check existence; the map to resolve the target file.
 */
var ALLOWED_PATHS = Object.freeze(Object.keys(ROUTE_MAP));

function handler(event) {
    var request = event.request;

    if (!request || typeof request.uri !== 'string') {
        var host = (request && request.headers && request.headers.host && request.headers.host.value) || '';
        console.log('cloudfront_routing: missing/invalid request.uri', 'host=', host, 'uri=', request && request.uri);
        return request;
    }

    try {
        var uri = request.uri;

        // Fast-path: explicitly allowed -> rewrite via ROUTE_MAP.
        if (Object.prototype.hasOwnProperty.call(ROUTE_MAP, uri)) {
            request.uri = ROUTE_MAP[uri];
            return request;
        }

        // Allow static assets (anything with an extension) to pass through.
        var lastSlash = uri.lastIndexOf('/');
        var lastSegment = uri.substring(lastSlash + 1);
        if (lastSegment.indexOf('.') !== -1) {
            return request;
        }

        // Narrow guard: only 404 unknown single-segment, extension-less paths.
        // Multi-segment paths (e.g., /en/docs) fall back to origin so S3 can decide.
        var parts = uri.split('/');
        var i = 0;
        var segmentCount = 0;
        for (i = 0; i < parts.length; i++) {
            if (parts[i]) {
                segmentCount++;
            }
        }

        if (segmentCount === 1) {
            // Unknown single-segment base -> issue CloudFront-level 404.
            return {
                statusCode: 404,
                statusDescription: 'Not Found',
                headers: { 'cache-control': { value: 'public, max-age=60' } }
            };
        }

        // Multi-segment or other cases: let origin handle (S3 may 404 if unknown).
        return request;
    } catch (err) {
        console.log('cloudfront_routing: error', err);
        return request;
    }
}