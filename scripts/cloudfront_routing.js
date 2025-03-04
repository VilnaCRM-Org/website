/**
 * CloudFront Function to handle URL routing for static assets
 * - Routes /index.html to /
 * - Routes /swagger.html to /swagger
 * - Preserves query parameters
 * 
 * @param {Object} event - The CloudFront function event object
 * @returns {Object} The modified event object
 */
function handler(event) {
    var request = event.request;
    var uri = request.uri;

    if (uri === "/index.html") {
        request.uri = "/";
    } else if (uri === "/swagger.html") {
        request.uri = "/swagger";
    } else if (uri.indexOf("/index.html?") === 0) {
        request.uri = "/" + uri.substring("/index.html".length);
    } else if (uri.indexOf("/swagger.html?") === 0) {
        request.uri = "/swagger" + uri.substring("/swagger.html".length);
    }

    return event;
}