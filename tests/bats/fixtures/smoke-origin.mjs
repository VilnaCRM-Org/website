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

// A response may be described once, or as a list replayed one entry per request —
// which is how the retry path is exercised: the first attempts are wrong, a later
// one is right.
const responses = Array.isArray(config) ? config : [config];
let served = 0;

const server = http.createServer((request, response) => {
  const shape = responses[Math.min(served, responses.length - 1)];
  served += 1;
  const headers = { ...(shape.headers ?? {}) };
  // Node adds a content-type of its own if none is given, which would mask the
  // very gap case #235 is about, so an explicit `null` removes it.
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
