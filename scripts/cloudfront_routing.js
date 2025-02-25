function handler(event) {
    var request = event.request;
    var uri = request.uri;

    if (uri === "/index.html") {
        request.uri = "/";
    } else if (uri === "/swagger.html") {
        request.uri = "/swagger";
    }

    return request;
}