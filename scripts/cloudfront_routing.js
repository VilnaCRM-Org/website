/**
 * CloudFront Function to handle URL routing for static assets
 * - Routes /index.html to /
 * - Routes /swagger.html to /swagger
 * 
 * @param {Object} event - The CloudFront function event object
 * @returns {Object} The modified event object
 */
function handler(event) {
    const request = event.request;
    const uri = request.uri;

    if (uri === "/index.html") {
        request.uri = "/";
    } else if (uri === "/swagger.html") {
        request.uri = "/swagger";
    }
    
    return event;
}