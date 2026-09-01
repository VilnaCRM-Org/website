#!/usr/bin/env node
/**
 * Prove the fail-closed allow-list in `scripts/cloudfront_routing.js` covers the whole
 * static export (issue #383).
 *
 * The edge handler returns the site 404 for any path it does not recognise. That is only
 * safe if its allow-list is a superset of the export: a too-tight table 404s real
 * production assets, and the failure is invisible until deploy. So load the byte-identical
 * ES5.1 handler (a bare `function handler(event)` with no `module.exports`, hence `node:vm`
 * rather than `require`) and run it over every file in the built export.
 *
 * This proves COMPLETENESS, not minimality: extra well-known entries (e.g. `/robots.txt`
 * pre-seeded for issue #339) are allowed, each carrying an issue reference in the handler.
 *
 * Invoked by `scripts/ci/validate-build-artifact.sh`, which runs on every PR via
 * `.github/workflows/build-artifact.yml`.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '../..');
const HANDLER_PATH = path.join(ROOT, 'scripts/cloudfront_routing.js');
const MAX_REPORTED = 50;

function fail(message) {
  console.error(`::error::edge-allowlist: ${message}`);
  process.exit(1);
}

function loadHandler() {
  const source = fs.readFileSync(HANDLER_PATH, 'utf8');
  // The handler logs diagnostics on malformed input; swallow them so a clean run stays
  // quiet, and give the vm its own context so nothing leaks into this process.
  const context = { console: { log() {} } };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.resolvedHandler = handler;`, context, {
    filename: HANDLER_PATH,
  });
  if (typeof context.resolvedHandler !== 'function') {
    fail(`${HANDLER_PATH} did not expose a handler function`);
  }
  return context.resolvedHandler;
}

// `readdirSync(recursive: true)` returns paths relative to the root as strings, which is
// available from Node 20.1 — well under the 24.18.0 pinned in .nvmrc. Deliberately NOT
// `Dirent.parentPath`, which only landed in 20.12.
function listExportedUris(outDir) {
  return fs
    .readdirSync(outDir, { recursive: true })
    .map(entry => String(entry).split(path.sep).join('/'))
    .filter(relative => fs.statSync(path.join(outDir, relative)).isFile())
    .map(relative => `/${relative}`)
    .sort();
}

// Reachable means the handler handed the request back untouched, so CloudFront forwards it
// to the origin. A rewritten URI (a ROUTE_MAP hit) or a synthetic response both count as
// "not served from this path".
function isReachable(handler, uri) {
  const request = { uri };
  const result = handler({ request });
  return result === request && request.uri === uri;
}

function main() {
  const outDir = path.resolve(process.argv[2] ?? 'out');
  if (!fs.existsSync(outDir)) {
    fail(`${outDir} does not exist; run \`make build-out\` first`);
  }

  const handler = loadHandler();
  const uris = listExportedUris(outDir);
  if (uris.length === 0) {
    fail(`${outDir} contains no files; the export is empty`);
  }

  const blocked = uris.filter(uri => !isReachable(handler, uri));
  if (blocked.length > 0) {
    const shown = blocked.slice(0, MAX_REPORTED);
    const overflow = blocked.length - shown.length;
    console.error(
      `::error::edge-allowlist: ${blocked.length} of ${uris.length} exported path(s) are ` +
        `blocked by scripts/cloudfront_routing.js and would 404 in production. Add them to ` +
        `ALLOWED_FILES / ALLOWED_DIRS / ALLOWED_EXTENSIONS there.`
    );
    for (const uri of shown) {
      console.error(`  blocked: ${uri}`);
    }
    if (overflow > 0) {
      console.error(`  … and ${overflow} more`);
    }
    process.exit(1);
  }

  console.log(`edge-allowlist: OK (${uris.length} exported paths reachable)`);
}

main();
