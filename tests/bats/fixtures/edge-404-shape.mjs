// Prints, as a smoke-origin.mjs config, the response the REAL edge handler
// (scripts/cloudfront_routing.js) returns for an unknown URI (issue #329).
//
// smoke-response-shape.sh blocks on a marker it expects in the edge 404 body.
// Serving the handler's own response, rather than a hand-copied fixture body,
// is what keeps the two from drifting apart: reword the edge document's title
// and the parity case in tests/bats/smoke_response_shape.bats goes red.
//
// The handler is a bare CloudFront Functions module with no exports, so it is
// evaluated in a vm context, exactly as the `edge` Jest layer loads it.
// Dependency-free (node: built-ins only) so it runs wherever `make test-bats` runs.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const [handlerPath, uri] = process.argv.slice(2);
const source = fs.readFileSync(handlerPath, 'utf8');
const context = { console: { log: () => {} } };
vm.createContext(context);
vm.runInContext(`${source}\nthis.resolvedHandler = handler;`, context, {
  filename: path.resolve(handlerPath),
});

const response = context.resolvedHandler({ request: { uri, headers: {} } });
if (typeof response.statusCode !== 'number') {
  process.stderr.write(`the edge handler did not answer ${uri} itself\n`);
  process.exit(1);
}

const headers = {};
for (const [name, { value }] of Object.entries(response.headers ?? {})) {
  headers[name] = value;
}
process.stdout.write(
  `${JSON.stringify({ status: response.statusCode, headers, body: response.body })}\n`
);
