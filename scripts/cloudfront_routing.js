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
});
// Build allowed base segments from ROUTE_MAP to avoid manual maintenance
var ALLOWED_BASES = (function () {
    var bases = Object.create(null);
    bases[''] = true;
    var keys = Object.keys(ROUTE_MAP);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var parts = key.split('/');
        var base = parts[1] || '';
        if (base) {
            bases[base] = true;
        }
    }
    return Object.freeze(bases);
}());
function handler(event) {
    var request = event.request;

    if (!request.uri || typeof request.uri !== 'string') {
        var host = (request.headers && request.headers.host && request.headers.host.value) || '';
        console.log('cloudfront_routing: missing/invalid request.uri', 'host=', host, 'uri=', request.uri);
        return request;
    }

    try {
        var uri = request.uri;
        var segments = uri.split('/');
        var lastSegment = segments[segments.length - 1];

        if (Object.prototype.hasOwnProperty.call(ROUTE_MAP, uri)) {
            request.uri = ROUTE_MAP[uri];
            return request;
        }

        var base = segments[1] || '';
        var hasExtension = lastSegment.indexOf('.') !== -1;
        if (!hasExtension) {
            var isAllowedBase = Object.prototype.hasOwnProperty.call(ALLOWED_BASES, base);
            if (!isAllowedBase) {
                return {
                    statusCode: 404,
                    statusDescription: 'Not Found',
                    headers: {
                        'cache-control': { value: 'public, max-age=60' }
                    }
                };
            }
        }

        var lastChar = (typeof uri === 'string') ? uri.charAt(uri.length - 1) : '';
        if (lastChar === '/') {
            request.uri = uri + 'index.html';
            return request;
        }

        else if (lastSegment.indexOf('.') === -1 && segments.length > 2) {
            request.uri = uri + '/index.html';
        }

        return request;
    } catch (error) {
        console.log('cloudfront_routing: error', error);
        return request;
    }
}
