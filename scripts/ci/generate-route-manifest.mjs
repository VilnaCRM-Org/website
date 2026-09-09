#!/usr/bin/env node
/**
 * Generate `config/routes.json`: the machine-readable map from public route to the object
 * key the static export actually produces (issue #333).
 *
 * WHY IT EXISTS. Route knowledge in this repository is hand-duplicated — the CloudFront
 * edge handler's `ROUTE_MAP` (`scripts/cloudfront_routing.js`), the a11y route registry,
 * the Lighthouse URL lists, the K6 endpoint block — and it had already drifted: `ROUTE_MAP`
 * mapped `/about` and `/en` at objects the export has never produced (there is no
 * `pages/about`, and `pages/en/` holds only `docs/api.tsx`), so both curated routes
 * rewrote to a missing S3 key and leaked a raw storage error instead of the site's
 * synthetic 404 — while `/en/docs/api`, the one route under `/en` that does ship, had no
 * entry at all and hard-404'd at the edge. Nothing in CI could see any of that, because
 * nothing derived the route set from `pages/`.
 *
 * WHAT IT PROVES. The committed manifest is the derived truth, and
 * `src/test/unit/routes/route-manifest.test.ts` regenerates it from `pages/` and compares
 * byte-for-byte, so an added page with no manifest entry — or a manifest entry with no page
 * — reds a PR. That spec also holds `ROUTE_MAP` to the manifest in both directions, which
 * is what would have caught the `/about` drift on the commit that introduced it.
 *
 * THE EXPORT LAYOUT IT ENCODES. `next.config.js` sets `output: 'export'` and leaves
 * `trailingSlash` unset, so Next writes one flat `<route>.html` per route rather than
 * `<route>/index.html`; the root is the sole exception (`/` -> `/index.html`). That is not
 * an assumption — it is the layout `scripts/ci/validate-build-artifact.sh` already pins for
 * `/swagger` -> `/swagger.html`, failing the build if a trailing-slash flip ever turns it
 * into `swagger/index.html`.
 *
 * WHAT IT DELIBERATELY DOES NOT DO.
 *   - It does not write `ROUTE_MAP`. The edge handler stays a hand-reviewed ES5.1 artifact
 *     that ships byte-identical to what is committed; the manifest gates it, it does not
 *     generate it. A curated map is also intentionally narrower than the manifest: a page
 *     may ship without being reachable at an extensionless edge URL (see the exemption
 *     recorded in the drift spec).
 *   - It does not read `out/`. It must run with no build, so the gate is hermetic and
 *     costs a PR nothing. Parity against a real export is a separate, build-time check
 *     (`scripts/ci/verify-edge-allowlist.mjs`).
 *   - It does not touch the Lighthouse or K6 configs. Wiring those to the manifest is the
 *     rest of #333 and carries its own risks (a new Lighthouse URL row destabilises the
 *     known-flaky mobile audit), so it is not smuggled in here.
 *
 * Usage: `node scripts/ci/generate-route-manifest.mjs` (idempotent; writes only the
 * manifest), or `--check` to verify the committed manifest without touching the working
 * tree — which is how the drift spec drives it, so the gate can never pass by quietly
 * rewriting the artifact it is meant to be checking. Dependency-free on purpose, like the
 * other pin/policy gates in this folder.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const PAGES_DIR = path.join(ROOT, 'pages');
const MANIFEST_PATH = path.join(ROOT, 'config/routes.json');

// Next treats these as page modules; anything else under `pages/` is not a route.
const PAGE_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js']);

// Framework modules that render no route of their own, plus the generated localization
// bundle. `pages/i18n/localization.json` is a build artifact written by
// `scripts/localizationGenerator.js`, not a page — and its `.json` extension already
// excludes it; it is named here so a future `.ts` spelling cannot silently become a route.
const NON_ROUTE_BASENAMES = new Set(['_app', '_document', '_error']);
const NON_ROUTE_DIRS = new Set(['i18n']);

function fail(message) {
  console.error(`::error::route-manifest: ${message}`);
  process.exit(1);
}

function listPageFiles(dir, prefix = '') {
  const files = [];
  for (const entry of fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!NON_ROUTE_DIRS.has(entry.name)) {
        files.push(...listPageFiles(path.join(dir, entry.name), relative));
      }
      continue;
    }
    const extension = path.extname(entry.name);
    const basename = path.basename(entry.name, extension);
    // `.d.ts` declares types and `foo.test.tsx` is a spec; neither is a route, and both
    // end in a page extension, so strip a second extension before deciding.
    if (!PAGE_EXTENSIONS.has(extension) || path.extname(basename) !== '') {
      continue;
    }
    if (NON_ROUTE_BASENAMES.has(basename)) {
      continue;
    }
    files.push(relative);
  }
  return files;
}

// `pages/index.tsx` -> `/`, `pages/swagger.tsx` -> `/swagger`,
// `pages/en/docs/api.tsx` -> `/en/docs/api`, `pages/en/index.tsx` -> `/en`.
function routeOf(relativeFile) {
  const withoutExtension = relativeFile.slice(0, -path.extname(relativeFile).length);
  const segments = withoutExtension.split('/');
  if (segments[segments.length - 1] === 'index') {
    segments.pop();
  }
  return `/${segments.join('/')}`.replace(/\/$/, '') || '/';
}

// With `trailingSlash` unset the export is flat: one `<route>.html` per route, `/` being
// the only route whose object is an `index.html`.
function objectPathOf(route) {
  return route === '/' ? '/index.html' : `${route}.html`;
}

function buildManifest(pagesDir = PAGES_DIR) {
  const manifest = {};
  for (const file of listPageFiles(pagesDir)) {
    // A dynamic segment has no single exported object without `getStaticPaths`, so it
    // cannot be expressed in this manifest. Refuse loudly rather than emit a literal
    // `/[slug].html` key that would silently become an edge route nothing serves.
    if (file.includes('[')) {
      fail(`dynamic route segment in pages/${file} is not representable in the manifest`);
    }
    const route = routeOf(file);
    if (Object.hasOwn(manifest, route)) {
      fail(`pages/${file} produces route ${route}, which is already claimed`);
    }
    manifest[route] = objectPathOf(route);
  }
  if (Object.keys(manifest).length === 0) {
    fail(`no page modules found under ${pagesDir}`);
  }
  return Object.fromEntries(
    Object.keys(manifest)
      .sort()
      .map(route => [route, manifest[route]])
  );
}

function serializeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function main() {
  if (!fs.existsSync(PAGES_DIR)) {
    fail(`${PAGES_DIR} does not exist`);
  }
  const checkOnly = process.argv.includes('--check');
  const serialized = serializeManifest(buildManifest());
  const current = fs.existsSync(MANIFEST_PATH) ? fs.readFileSync(MANIFEST_PATH, 'utf8') : null;
  if (current === serialized) {
    console.log('route-manifest: config/routes.json already up to date');
    return;
  }
  if (checkOnly) {
    fail(
      'config/routes.json is stale; run `node scripts/ci/generate-route-manifest.mjs` and ' +
        'commit the result'
    );
  }
  fs.writeFileSync(MANIFEST_PATH, serialized);
  console.log('route-manifest: wrote config/routes.json');
}

if (process.argv[1] === import.meta.filename) {
  main();
}
