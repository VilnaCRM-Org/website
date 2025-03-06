function handler(event) {
    const request = event.request;
    let uri = request.uri;
    
    // Mapping of routes to their rewritten URIs for dynamic routing
    const routeMap = {
      "/": "/index.html",               // Root path -> serve the index.html file
      "/about": "/about/index.html",    // '/about' -> '/about/index.html'
      "/about/": "/about/index.html",   // '/about/' -> '/about/index.html'
      // Add other routes that need special handling:
      // e.g., old paths redirected to new paths or default documents for sections.
      // Example:
      // "/old-page": "/new-page",      // redirect '/old-page' -> '/new-page'
      // Internationalization (i18n) examples for language-specific homepages:
      "/en": "/en/index.html",          // '/en' -> '/en/index.html' (English homepage)
      "/en/": "/en/index.html",         // '/en/' -> '/en/index.html'
      // You can add "/fr": "/fr/index.html", "/fr/": "/fr/index.html", etc., for other languages.
      "/swagger": "/swagger.html",
      "/test": "/_next/static/media/desktop.0ec56f83.jpg"
    };
  
    // If the request URI matches a key in routeMap, rewrite it
    if (routeMap.hasOwnProperty(uri)) {
      uri = routeMap[uri];
    } else {
      // If URI is a directory (ends with '/') or a clean path with no file extension, append 'index.html'
      if (uri.endsWith('/')) {
        uri += 'index.html';
      } else if (uri.lastIndexOf('.') === -1) {
        // No '.' found in the URI path => likely a clean path (no file extension)
        uri += '/index.html';
      }
    }
  
    // Update the request URI and return the request object
    request.uri = uri;
    return request;
  }