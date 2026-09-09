/**
 * Hold the two hand-maintained route surfaces to the pages that actually exist (issue #333).
 *
 * `config/routes.json` is generated from `pages/` by
 * `scripts/ci/generate-route-manifest.mjs`, and `ROUTE_MAP` in
 * `scripts/cloudfront_routing.js` is the curated subset CloudFront rewrites at the edge.
 * Both used to be maintained by hand and both had drifted: `ROUTE_MAP` mapped `/about` and
 * `/en` at `/about/index.html` and `/en/index.html`, objects the export has never produced
 * (there is no `pages/about`; `pages/en/` holds only `docs/api.tsx`), so those routes
 * rewrote to a missing S3 key and leaked a raw storage error instead of the site's synthetic
 * 404 — while the route that does ship, `/en/docs/api`, had no entry and hard-404'd at the
 * edge. Nothing failed, because nothing derived the route set from the filesystem.
 *
 * So this spec fails in BOTH directions:
 *   - regenerating the manifest from `pages/` must reproduce the committed
 *     `config/routes.json` byte for byte (an added page with no manifest entry reds it, and
 *     so does a manifest entry with no page);
 *   - every manifest route must be reachable through `ROUTE_MAP` (bar the recorded
 *     exemption below), and every `ROUTE_MAP` target must be a manifest object path (a
 *     stale `/about` reds it).
 *
 * The generator is driven as a child process in `--check` mode rather than imported: it is
 * an ESM script under `scripts/`, and importing it would pull it into this layer's
 * imported-file coverage denominator, and a `--check` run also cannot make itself pass by
 * rewriting the very artifact under test.
 *
 * The handler is a bare ES5.1 CloudFront Functions module with no `module.exports`, so it
 * is read with `node:fs` and evaluated with `node:vm` exactly as the `edge` layer does —
 * the deployed artifact must stay byte-identical to what ships. Nothing here imports from
 * `src/`, so this spec adds no files to the client coverage denominator (the same reason
 * `src/test/unit/robots-txt.test.ts` reads its subject from disk).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const REPO_ROOT: string = path.resolve(__dirname, '../../../..');
const MANIFEST_PATH: string = path.join(REPO_ROOT, 'config/routes.json');
const HANDLER_PATH: string = path.join(REPO_ROOT, 'scripts/cloudfront_routing.js');
const GENERATOR_PATH: string = path.join(REPO_ROOT, 'scripts/ci/generate-route-manifest.mjs');

/**
 * Manifest routes that are deliberately NOT edge-mapped, each with the reason it is
 * exempt. This list is what keeps the "every route needs a ROUTE_MAP entry" rule honest
 * for a genuinely intentional gap instead of the rule being softened for everyone.
 */
const UNMAPPED_ROUTES: Readonly<Record<string, string>> = {
  '/offline':
    'The PWA fallback is precached and served by public/sw.js as /offline.html, an ' +
    'exact ALLOWED_FILES entry; no extensionless /offline URL is ever navigated to.',
};

function loadRouteMap(): Record<string, string> {
  const source: string = fs.readFileSync(HANDLER_PATH, 'utf8');
  const context: { ROUTE_MAP?: Record<string, string>; console: { log: () => void } } = {
    console: { log: (): void => {} },
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: HANDLER_PATH });
  if (context.ROUTE_MAP === undefined) {
    throw new Error('cloudfront_routing.js did not declare a ROUTE_MAP');
  }
  return context.ROUTE_MAP;
}

const committed: string = fs.readFileSync(MANIFEST_PATH, 'utf8');
const manifest: Record<string, string> = JSON.parse(committed) as Record<string, string>;
const routeMap: Record<string, string> = loadRouteMap();

// A ROUTE_MAP key may carry a trailing slash (`/swagger/`); the manifest never does.
function canonicalRoute(uri: string): string {
  return uri.length > 1 && uri.endsWith('/') ? uri.slice(0, -1) : uri;
}

describe('config/routes.json is generated, not maintained', () => {
  test('regenerating the manifest from pages/ reproduces the committed file byte for byte', () => {
    const before: string = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const output: string = execFileSync(process.execPath, [GENERATOR_PATH, '--check'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(output).toContain('already up to date');
    // `--check` must not have written anything; a gate that repairs its own subject
    // proves nothing.
    expect(fs.readFileSync(MANIFEST_PATH, 'utf8')).toBe(before);
  });

  test('every manifest entry maps a route to the flat object the export writes', () => {
    expect(Object.keys(manifest).length).toBeGreaterThan(0);
    for (const [route, object] of Object.entries(manifest)) {
      expect(route.startsWith('/')).toBe(true);
      expect(object).toBe(route === '/' ? '/index.html' : `${route}.html`);
    }
  });

  test('the root route is present and the only one exported as an index.html', () => {
    const indexRoutes: string[] = Object.entries(manifest)
      .filter(([, object]) => object.endsWith('/index.html'))
      .map(([route]) => route);
    expect(indexRoutes).toEqual(['/']);
  });
});

describe('ROUTE_MAP parity with the manifest', () => {
  test('every manifest route is reachable through ROUTE_MAP, or is a recorded exemption', () => {
    const mapped: Set<string> = new Set(Object.keys(routeMap).map(canonicalRoute));
    const missing: string[] = Object.keys(manifest).filter(
      route => !mapped.has(route) && !Object.hasOwn(UNMAPPED_ROUTES, route)
    );
    expect(missing).toEqual([]);
  });

  test('every ROUTE_MAP entry rewrites to the object its manifest route declares', () => {
    for (const [uri, target] of Object.entries(routeMap)) {
      const route: string = canonicalRoute(uri);
      // A target with no manifest route is the `/about` drift: it rewrites at an object
      // no page produces, so the origin answers with a raw storage error.
      expect(Object.hasOwn(manifest, route)).toBe(true);
      expect(target).toBe(manifest[route]);
    }
  });

  test('no exemption is recorded for a route that is mapped or does not exist', () => {
    for (const [route, reason] of Object.entries(UNMAPPED_ROUTES)) {
      expect(Object.hasOwn(manifest, route)).toBe(true);
      expect(Object.hasOwn(routeMap, route)).toBe(false);
      expect(reason.length).toBeGreaterThan(20);
    }
  });

  test('ROUTE_MAP accepts both the bare and the trailing-slash spelling of each route', () => {
    // `/` is the one route with no trailing-slash spelling of its own: `/` IS the slash.
    const nonRoot: string[] = Object.keys(routeMap)
      .map(canonicalRoute)
      .filter(route => route !== '/');
    for (const route of nonRoot) {
      expect(routeMap[route]).toBeDefined();
      expect(routeMap[`${route}/`]).toBe(routeMap[route]);
    }
    expect(routeMap['/']).toBe('/index.html');
  });

  test('the stale pre-#333 entries are gone and the real /en route is mapped', () => {
    expect(Object.hasOwn(routeMap, '/about')).toBe(false);
    expect(Object.hasOwn(routeMap, '/en')).toBe(false);
    expect(routeMap['/en/docs/api']).toBe('/en/docs/api.html');
  });
});
