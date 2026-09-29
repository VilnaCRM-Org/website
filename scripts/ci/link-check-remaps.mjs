#!/usr/bin/env node
/**
 * Emit the lychee `--remap` rules under which the weekly link check resolves an extensionless
 * route exactly the way the CloudFront edge does (issue #508).
 *
 * The static export has no `trailingSlash`, so `/swagger` ships as `out/swagger.html`, and
 * production only serves it because `ROUTE_MAP` in `scripts/cloudfront_routing.js`
 * rewrites the URI. lychee resolves a root-relative href against `--root-dir` literally, so
 * without these rules every server-rendered link to a route (`<a href="/swagger">` on
 * `/en/docs/api`) is reported as "File not found" although the live site serves it.
 *
 * lychee's `--fallback-extensions html` would silence that too, but it is broader than the
 * edge: it accepts `/offline`, `/404` and `/index` because their `.html` files exist, and
 * the edge hard-404s all three (`/offline` is the recorded ROUTE_MAP exemption in
 * `src/test/unit/routes/route-manifest.test.ts`). So the rules are derived from the
 * handler's own table instead: one anchored rule per ROUTE_MAP route, rewriting it to that
 * route's target and carrying any `?query` or `#fragment` across -- the edge matches on the
 * URI without its query string, and `--include-fragments` must still check the anchor. A
 * route the edge does not map gets no rule and keeps failing.
 *
 * lychee drops a trailing slash before it resolves a local path, so `/en` and `/en/` reach
 * it as the same file URI. A route is therefore remapped only through its bare spelling
 * (the root `/` is its own), and a slash-only entry, or a pair whose two spellings rewrite
 * to different targets, is refused rather than guessed.
 *
 * Usage: node scripts/ci/link-check-remaps.mjs <site-root>
 *   <site-root> is the absolute directory lychee is given as `--root-dir`, as lychee sees
 *   it (inside the container). One rule is printed per line, in lychee's
 *   `<regex> <replacement>` form.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '../..');
const HANDLER_PATH = path.join(ROOT, 'scripts/cloudfront_routing.js');

function fail(message) {
  console.error(`::error::link-check-remaps: ${message}`);
  process.exit(1);
}

// Evaluated with node:vm, not required: the handler is a bare ES5.1 CloudFront Functions
// script with no exports, and `var ROUTE_MAP` becomes a property of the vm context.
function loadRouteMap() {
  const context = { console: { log() {} } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(HANDLER_PATH, 'utf8'), context, { filename: HANDLER_PATH });
  if (context.ROUTE_MAP === null || typeof context.ROUTE_MAP !== 'object') {
    fail(`${HANDLER_PATH} did not declare a ROUTE_MAP object`);
  }
  return context.ROUTE_MAP;
}

// lychee splits a rule on whitespace, so a site root containing any cannot be expressed.
function readSiteRoot(argument) {
  if (typeof argument !== 'string' || !argument.startsWith('/') || /\s/.test(argument)) {
    fail('usage: link-check-remaps.mjs <site-root> (an absolute path without whitespace)');
  }
  return argument.replace(/\/+$/, '');
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bareSpelling(route) {
  return route === '/' ? '' : route.replace(/\/$/, '');
}

function assertSpellingsAgree(routeMap, route) {
  const bare = bareSpelling(route);
  if (route === '/' || bare === route) {
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(routeMap, bare)) {
    fail(`ROUTE_MAP maps ${route} but not ${bare}; lychee cannot tell the two apart`);
  }
  if (routeMap[bare] !== routeMap[route]) {
    fail(`ROUTE_MAP rewrites ${bare} and ${route} to different targets`);
  }
}

function buildRemaps(routeMap, siteRoot) {
  const rules = [];
  for (const route of Object.keys(routeMap).sort()) {
    assertSpellingsAgree(routeMap, route);
    if (route !== '/' && route.endsWith('/')) {
      continue;
    }
    const target = routeMap[route];
    const pattern = `^file://${escapeRegex(siteRoot + bareSpelling(route))}/?([?#].*)?$`;
    const replacement = `file://${siteRoot}${target}`.replace(/\$/g, '$$$$');
    rules.push(`${pattern} ${replacement}$1`);
  }
  return rules;
}

function main() {
  const siteRoot = readSiteRoot(process.argv[2]);
  const rules = buildRemaps(loadRouteMap(), siteRoot);
  if (rules.length === 0) {
    fail(`${HANDLER_PATH} declares no ROUTE_MAP routes to remap`);
  }
  process.stdout.write(`${rules.join('\n')}\n`);
}

main();
