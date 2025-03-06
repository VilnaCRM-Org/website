function handler(event) {
    var request = event.request;
    var uri = request.uri;
  
    // Route mapping for static files and specific routes
    var routeMap = {
      "/": "/index.html",               // Root path -> serve the index.html file
      "/about": "/about/index.html",    // '/about' -> '/about/index.html'
      "/about/": "/about/index.html",   // '/about/' -> '/about/index.html'
      "/en": "/en/index.html",          // '/en' -> '/en/index.html' (English homepage)
      "/en/": "/en/index.html",         // '/en/' -> '/en/index.html'
      "/swagger": "/swagger.html",      // '/swagger' -> '/swagger.html'
      "/test": "/_next/static/media/desktop.0ec56f83.jpg" // Specific file for '/test'
    };
  
    // If the URI matches any key in the routeMap, rewrite it
    if (routeMap[uri] !== undefined) {
      uri = routeMap[uri];
    } else {
      // If the URI is a directory or does not have an extension, add 'index.html'
      if (uri.charAt(uri.length - 1) === '/') {
        uri += 'index.html';
      } else if (uri.indexOf('.') === -1) {
        uri += '/index.html';
      }
    }
  
    // Update the request URI and return the modified request object
    request.uri = uri;
    return request;
  }
