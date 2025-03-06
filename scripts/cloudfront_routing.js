function handler(event) {
    var request = event.request;
    var uri = request.uri;

    try {
        if (!uri || typeof uri !== "string") {
            return request;
        }

        var routeMap = {
            "/": "/index.html",
            "/about": "/about/index.html",
            "/about/": "/about/index.html",
            "/en": "/en/index.html",
            "/en/": "/en/index.html",
            "/swagger": "/swagger.html",
            "/test": "/_next/static/media/desktop.0ec56f83.jpg"
        };

        if (routeMap[uri] !== undefined) {
            uri = routeMap[uri];
        } else if (uri.substr(-1) === '/') {
            uri += 'index.html';
        } else if (uri.indexOf('.') === -1) {
            uri += '/index.html';
        }

        request.uri = uri;
        return request;
    } catch (e) {
        return request; // Возвращаем request без изменений в случае ошибки
    }
}