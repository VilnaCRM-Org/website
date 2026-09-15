// A stand-in origin for tests/bats/uptime_check.bats (issue #336).
//
// The sibling smoke-origin.mjs replays one response shape per REQUEST, which is
// the right model for a script that probes a single unknown URI. The uptime check
// probes two known documents — `/` and `/swagger` — and the cases that matter are
// the ones where they disagree: the homepage is up while the API docs are gone,
// or the homepage recovers on the second attempt while the other never does. So
// this fixture keys its shapes by PATH, and each path may carry a list replayed
// one entry per request to that path.
//
// A path the config does not name answers the site's own 404, which is what a
// deployed distribution does for a document that is not in the export — so a
// case that configures only `/` is a case where `/swagger` is missing.
//
// Dependency-free (node:http only) so it runs wherever `make test-bats` runs.
import fs from 'node:fs';
import http from 'node:http';

const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const NOT_FOUND = {
  status: 404,
  headers: { 'content-type': 'text/html' },
  body: '<html><body>404</body></html>',
};

const served = new Map();

function shapesFor(pathname) {
  const configured = config[pathname];
  if (configured === undefined) {
    return [NOT_FOUND];
  }
  return Array.isArray(configured) ? configured : [configured];
}

const server = http.createServer((request, response) => {
  const { pathname } = new URL(request.url, 'http://127.0.0.1');
  const responses = shapesFor(pathname);
  const count = served.get(pathname) ?? 0;
  served.set(pathname, count + 1);
  const shape = responses[Math.min(count, responses.length - 1)];
  const headers = { ...(shape.headers ?? {}) };
  // `writeHead` stringifies a header value, so a JSON `null` would reach the wire
  // as the literal `content-type: null` — present and wrong, when the case being
  // staged is a header that is ABSENT. Deleting the key is what omits it.
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) {
      delete headers[name];
    }
  }
  response.writeHead(shape.status ?? 200, headers);
  response.end(shape.body ?? '');
});

server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`PORT=${server.address().port}\n`);
});
