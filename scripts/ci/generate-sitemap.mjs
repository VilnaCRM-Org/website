#!/usr/bin/env node
/**
 * Generate `public/sitemap.xml`: the crawlable index of the static export (issue #339).
 *
 * WHY IT EXISTS. `public/robots.txt` has declared `Sitemap: …/sitemap.xml` since #383 and
 * nothing produced that document — so the one file crawlers are pointed at 404'd, and the
 * site's discoverability rested on a dangling reference. Writing the list by hand would
 * only move the drift: a page added under `pages/` would ship while the sitemap silently
 * kept describing the site as it used to be.
 *
 * WHAT IT DERIVES FROM. `config/routes.json` — the manifest generated from `pages/` by
 * `generate-route-manifest.mjs` — is the route set, so a new page reaches the sitemap the
 * same way it reaches the edge's ROUTE_MAP parity check: automatically, or a gate reds. The
 * origin is read back out of the `Sitemap:` directive in `public/robots.txt`, which already
 * had to name it; that keeps the two artifacts consistent by construction instead of adding
 * a third place to edit.
 *
 * The rules themselves live in the importable `./sitemap.mjs`, so a spec can drive them
 * over inputs this repository does not contain; this file is the thin CLI around them.
 *
 * Usage: `node scripts/ci/generate-sitemap.mjs` (idempotent; writes only the sitemap), or
 * `--check` to verify the committed file without touching the working tree — which is how
 * `src/test/unit/seo/sitemap.test.ts` drives it, so the gate can never pass by quietly
 * rewriting the artifact it is meant to be checking. Dependency-free on purpose, like the
 * other generators and pin gates in this folder.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { buildSitemap, readOriginFromRobots } from './sitemap.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MANIFEST_PATH = path.join(ROOT, 'config/routes.json');
const ROBOTS_PATH = path.join(ROOT, 'public/robots.txt');
const SITEMAP_PATH = path.join(ROOT, 'public/sitemap.xml');

function fail(message) {
  console.error(`::error::sitemap: ${message}`);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    fail(`${MANIFEST_PATH} does not exist; run \`make generate-routes\` first`);
  }
  if (!fs.existsSync(ROBOTS_PATH)) {
    fail(`${ROBOTS_PATH} does not exist; the sitemap origin is read from its Sitemap directive`);
  }

  let serialized;
  try {
    const routes = Object.keys(JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')));
    const origin = readOriginFromRobots(fs.readFileSync(ROBOTS_PATH, 'utf8'));
    serialized = buildSitemap(routes, origin);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const checkOnly = process.argv.includes('--check');
  const current = fs.existsSync(SITEMAP_PATH) ? fs.readFileSync(SITEMAP_PATH, 'utf8') : null;
  if (current === serialized) {
    console.log('sitemap: public/sitemap.xml already up to date');
    return;
  }
  if (checkOnly) {
    fail('public/sitemap.xml is stale; run `make generate-sitemap` and commit the result');
  }
  fs.writeFileSync(SITEMAP_PATH, serialized);
  console.log('sitemap: wrote public/sitemap.xml');
}

if (process.argv[1] === import.meta.filename) {
  main();
}
