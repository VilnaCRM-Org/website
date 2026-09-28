// A stand-in origin for tests/bats/smoke_response_shape.bats (issue #363).
//
// The smoke script's whole subject is what comes back over HTTP — a status line,
// a body that may be empty, and a header block — so a `curl` stub would only test
// the stub. This serves the real thing instead: the response shape is read from a
// JSON file, the port is chosen by the OS and printed on stdout, and the script
// under test then runs against a genuine curl round-trip.
//
// Dependency-free (node:http only) so it runs wherever `make test-bats` runs.
import fs from 'node:fs';
import http from 'node:http';

const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

// A response may be described once, or as a LIST replayed one entry per request —
// how the retry path is exercised: early attempts are wrong, a later one is right.
// The cache-control advisory (issue #333) needs a second axis that order alone
// cannot express: two DIFFERENT simultaneous shapes, a document at `/` and an
// asset under `/_next/static/`. A config carrying a `paths` key switches to
// per-path mode: `paths` maps a request path to its own shape (itself once or a
// replayed list), and `default` covers every other path, including the
// negative-path probe's random nonexistent path. A config with no `paths` key
// keeps the original order-only behaviour, unchanged, so none of the existing
// cases (#226/#229/#235/#249) need to change.
const isPathMap =
  !Array.isArray(config) && config !== null && typeof config === 'object' && 'paths' in config;

function asOrderedList(value) {
  return Array.isArray(value) ? value : [value];
}

const orderedResponses = isPathMap ? null : asOrderedList(config);

// One call counter per replay key ('default', or a path from `paths`), so a list
// under one key replays independently of a list under another.
const served = new Map();

function nextShape(key, shapeOrList) {
  if (!Array.isArray(shapeOrList)) {
    return shapeOrList;
  }
  const count = served.get(key) ?? 0;
  served.set(key, count + 1);
  return shapeOrList[Math.min(count, shapeOrList.length - 1)];
}

const server = http.createServer((request, response) => {
  let shape;
  if (isPathMap) {
    const { pathname } = new URL(request.url, 'http://127.0.0.1');
    const forPath = config.paths[pathname];
    shape =
      forPath !== undefined ? nextShape(pathname, forPath) : nextShape('default', config.default);
  } else {
    shape = nextShape('default', orderedResponses);
  }
  const headers = { ...(shape.headers ?? {}) };
  // `writeHead` stringifies a header value, so a JSON `null` would reach the wire as
  // the literal `content-type: null` — a header that is present and wrong, when the
  // case being staged (#235) is a header that is ABSENT. Deleting the key is what
  // actually omits it; node:http adds no content-type of its own.
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) {
      delete headers[name];
    }
  }
  response.writeHead(shape.status ?? 404, headers);
  response.end(shape.body ?? '');
});

server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`PORT=${server.address().port}\n`);
});
