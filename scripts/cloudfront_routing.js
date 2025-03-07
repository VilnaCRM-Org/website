/**
 * This script follows ES5.1 rules for compatibility.
 * - Avoids ES6+ syntax (e.g., `let`, `const`, arrow functions).
 */
'use strict';
function handler(event) {
    var request = event.request;
    
    // Early return for invalid URIs
    if (!request.uri || typeof request.uri !== "string") {
        return request;
    }
    
    try {
        var uri = request.uri;
        
        // Mapping of routes to their rewritten URIs for dynamic routing
        var routeMap = {
            "/": "/index.html",             // Root path -> serve the index.html file
            "/about": "/about/index.html",  // '/about' -> '/about/index.html'
            "/about/": "/about/index.html", // '/about/' -> '/about/index.html'
            // Add other routes that need special handling:
            // e.g., old paths redirected to new paths or default documents for sections.
            // Example:
            // "/old-page": "/new-page",      // redirect '/old-page' -> '/new-page'
            // Internationalization (i18n) examples for language-specific homepages:
            "/en": "/en/index.html",
            "/en/": "/en/index.html",
            // You can add "/fr": "/fr/index.html", "/fr/": "/fr/index.html", etc., for other languages.
            "/swagger": "/swagger.html",    // '/swagger' -> '/swagger.html'
            "/test": "/_next/static/media/desktop.0ec56f83.jpg"
        };
        
        // Check for direct route mapping first
        if (routeMap[uri] !== undefined) {
            request.uri = routeMap[uri];
            return request;
        }
        
        // Handle default routing cases
        if (uri.substr(-1) === '/') {
            uri += 'index.html';
        } else if (uri.indexOf('.') === -1) {
            uri += '/index.html';
        }
        
        request.uri = uri;
        return request;
    } catch (error) {
        // Log error and return unmodified request
        console.log('CloudFront Function error:', error);
        return request;
    }
}