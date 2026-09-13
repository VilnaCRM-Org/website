/**
 * Unit coverage for the CloudFront Functions edge handler that fronts every
 * production request (`scripts/cloudfront_routing.js`).
 *
 * That file is a bare ES5.1 CloudFront Functions module — `function handler(event) {}`
 * with no `module.exports` — so a plain `require()` returns `{}`. It is loaded here via
 * `node:fs` + `node:vm` so the deployed artifact stays byte-identical; passing the real
 * file path as `filename` lets the coverage provider attribute the executed code back to
 * the source file, which the `edge` Jest layer (`TEST_ENV=edge`, node env) gates at 100%.
 *
 * The vm context is given its own `console` so the handler's diagnostic logging is
 * observable and isolated from the test runner's console.
 *
 * The assertions pin the FULL viewer-response shape for the 404 branch because that is the
 * repo's most-recurrent production defect class (see issue #349):
 *   - #226 / #229 — CloudFront returned 500 instead of 404 on unknown paths.
 *   - #235       — Safari downloaded 404s because the `content-type` header was missing.
 *   - #249       — a missing `body` field on the 404 response caused 5xx.
 * Reverting any of those fixes must turn this suite red.
 *
 * Since issue #383 the handler is FAIL-CLOSED, so this suite also pins both halves of that
 * contract: `allowlisted export paths` (every shape the export ships still reaches the
 * origin) and `fail-closed allowlist` (everything else is answered here, not by S3). The
 * two are complementary — a table that only checked blocking would stay green while the
 * allow-list silently 404'd the whole site.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

interface CloudFrontRequest {
  uri?: unknown;
  headers?: { host?: { value?: string } };
}
interface CloudFrontResponse {
  statusCode: number;
  statusDescription: string;
  headers: Record<string, { value: string }>;
  body: string;
}
type CloudFrontEvent = { request?: CloudFrontRequest };
type CloudFrontHandler = (event: CloudFrontEvent) => CloudFrontRequest | CloudFrontResponse;

const REPO_ROOT: string = path.resolve(__dirname, '../../..');
const HANDLER_PATH: string = path.join(REPO_ROOT, 'scripts/cloudfront_routing.js');

const policyHeaders: Record<string, string> = (
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'config/security-headers.json'), 'utf8')) as {
    headers: Record<string, string>;
  }
).headers;

const vmConsole: { log: jest.Mock } = { log: jest.fn() };

function loadHandler(): CloudFrontHandler {
  const source: string = fs.readFileSync(HANDLER_PATH, 'utf8');
  const context: { resolvedHandler?: CloudFrontHandler; console: { log: jest.Mock } } = {
    console: vmConsole,
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.resolvedHandler = handler;`, context, {
    filename: HANDLER_PATH,
  });
  if (typeof context.resolvedHandler !== 'function') {
    throw new Error('cloudfront_routing.js did not expose a handler function');
  }
  return context.resolvedHandler;
}

const handler: CloudFrontHandler = loadHandler();

function asResponse(result: CloudFrontRequest | CloudFrontResponse): CloudFrontResponse {
  return result as CloudFrontResponse;
}

describe('cloudfront_routing handler', () => {
  beforeEach(() => {
    vmConsole.log.mockClear();
  });

  // Every row is a route `config/routes.json` derives from `pages/`, rewritten to the flat
  // object the `trailingSlash`-less export writes. Until issue #333 this table asserted
  // `/about` -> `/about/index.html` and `/en` -> `/en/index.html`, pinning a drift: neither
  // object exists in the export, so both rewrites leaked a raw S3 error in production.
  // `src/test/unit/routes/route-manifest.test.ts` now holds the map to the manifest in both
  // directions, so a repeat cannot be pinned here again.
  describe('exact route rewrites', () => {
    test.each([
      ['/', '/index.html'],
      ['/en/docs/api', '/en/docs/api.html'],
      ['/en/docs/api/', '/en/docs/api.html'],
      ['/swagger', '/swagger.html'],
      ['/swagger/', '/swagger.html'],
    ])('rewrites %s to %s and passes the request through', (uri, expected) => {
      const request: CloudFrontRequest = { uri };
      const result = handler({ request });
      expect(result).toBe(request);
      expect((result as CloudFrontRequest).uri).toBe(expected);
      expect(vmConsole.log).not.toHaveBeenCalled();
    });
  });

  // Every row is a real path the static export ships (or, for /robots.txt and /sitemap.xml,
  // one issue #339 will ship). scripts/ci/verify-edge-allowlist.mjs proves the allow-list
  // covers the WHOLE export on every PR; this table is the fast unit-level echo of that.
  describe('allowlisted export paths', () => {
    test.each([
      '/index.html',
      '/404.html',
      '/favicon.svg',
      '/supportUkraine.svg',
      '/vercel.svg',
      '/swagger.html',
      '/swagger-schema.json',
      '/robots.txt',
      '/sitemap.xml',
      '/.well-known/security.txt',
      '/_next/static/chunks/main-0f1e2d.js',
      '/_next/static/css/8b2c1d.css',
      '/_next/static/media/tablet.c1e077c2_96.webp',
      '/_next/static/media/inter.woff2',
      '/_next/static/media/hero.jpg',
      '/_next/static/jbV6vmKCu_JUrGFCr7onL/_buildManifest.js',
      '/en/docs/api.html',
      '/en/logo.svg',
      '/images/swagger/lock.svg',
      '/layout/favicon/favicon.ico',
      '/layout/favicon/site.webmanifest',
      '/layout/favicon/browserconfig.xml',
      '/layout/favicon/32x32.png',
    ])('leaves %s untouched', uri => {
      const request: CloudFrontRequest = { uri };
      const result = handler({ request });
      expect(result).toBe(request);
      expect((result as CloudFrontRequest).uri).toBe(uri);
    });
  });

  // The heart of issue #383. Most of these rows reached the S3 origin before the fail-closed
  // rewrite and must now be answered by this function instead; the extension-less single-segment
  // rows (`/images/`, `/Swagger`, `/swaggerx`, `/about-x`, `/toString`, `/constructor`,
  // `/__proto__`, `no-leading-slash`) were already 404'd by the old segment-count branch and are
  // pinned here so the allow-list rewrite cannot regress them. `/secret.json` is the acceptance
  // criterion's own example, `.js.map` is the source-map leak the allow-list exists to make
  // impossible even if `productionBrowserSourceMaps` is ever flipped on, and the dotfiles that
  // carry a second dot are the ones that borrowed an allow-listed extension until `extensionOf`
  // learned to reject a leading-dot segment. The `%`-carrying rows are the encoded spelling of
  // exactly those dotfiles: CloudFront does not decode `request.uri`, so `%2E`/`%2e` hides the
  // leading dot from `extensionOf` while S3 decodes the key back to `.env.js`, and `%2F` moves
  // where the last segment begins at all. `%zz` is a malformed escape, pinned because decoding
  // it would throw into the handler's catch and fail OPEN. The dot-segment rows cover the other
  // half of the same hole: they satisfy the directory and extension tests yet resolve elsewhere.
  // `/about` and `/en` are the two routes issue #333 removed from ROUTE_MAP: neither object
  // was ever exported, so both must now take the synthetic 404 rather than a broken rewrite.
  describe('fail-closed allowlist', () => {
    test.each([
      '/secret.json',
      '/.env',
      '/style.css',
      '/nested/app.js',
      '/deep/dir/photo.png',
      '/a/b',
      '/blog/post/extra',
      '/one/two/three',
      '/en/docs',
      '/en/.hidden',
      '/en/.hidden.html',
      '/images/.env.js',
      '/_next/.eslintrc.js',
      '/en/%2Ehidden.html',
      '/images/%2Eenv.js',
      '/images/%2eenv.js',
      '/images/%252Eenv.js',
      '/_next/%2Eeslintrc.js',
      '/images/a%2F.env.js',
      '/images/%zz.js',
      '/images/../style.css',
      '/images/./style.css',
      '/images/',
      '/_next/static/chunks/main-0f1e2d.js.map',
      '/_NEXT/static/chunks/main.js',
      '/Swagger',
      '/swaggerx',
      '/about-x',
      '/about',
      '/en',
      '/toString',
      '/constructor',
      '/__proto__',
      'no-leading-slash',
    ])('returns the site 404 for %s', uri => {
      const request: CloudFrontRequest = { uri };
      const result = asResponse(handler({ request }));
      expect(result).not.toBe(request);
      expect(result.statusCode).toBe(404);
      expect(result.statusDescription).toBe('Not Found');
      // A complete document, not merely a non-empty string: #249 shipped a response with
      // no body at all. The literal "404" left this assertion when the body became the
      // branded page of #339 — the status line is where a 404 is stated, and a visitor
      // reading a status code is not the audience this document is for.
      expect(result.body).toContain('<!DOCTYPE html>');
      expect(result.body).toContain('</html>');
      // The full documented shape, not just the status: a dropped content-type
      // made Safari download the 404 (#235) and a missing body produced a 5xx
      // (#249). Those regressions must be caught on every blocked path, not only
      // on the single top-level case below.
      expect(result.headers['content-type']?.value).toBe('text/html; charset=utf-8');
      expect(result.headers['cache-control']?.value).toBe('public, max-age=60');
    });

    test('a blocked nested path returns the same 404 shape as a blocked top-level path', () => {
      const nested = asResponse(handler({ request: { uri: '/blog/post/extra' } }));
      const top = asResponse(handler({ request: { uri: '/does-not-exist' } }));
      expect(nested).toEqual(top);
    });
  });

  describe('unknown top-level path', () => {
    const request: CloudFrontRequest = { uri: '/does-not-exist' };
    const response = asResponse(handler({ request }));

    test('returns a synthetic 404 response instead of the request', () => {
      expect(response).not.toBe(request);
      expect(response.statusCode).toBe(404);
      expect(response.statusDescription).toBe('Not Found');
    });

    test('includes a non-empty body (guards #249: missing body -> 5xx)', () => {
      expect(response.body).toBeTruthy();
      expect(response.body).toContain('<!DOCTYPE html>');
    });

    test('serves a branded, self-contained document a visitor can act on (#339)', () => {
      // A viewer-request function returns a body, it cannot fetch one, so nothing this
      // document references can load: every rule has to be inline and there must be a way
      // out that needs no JavaScript. Before #339 the body was one bare `<h1>404 - Page
      // Not Found</h1>` on the browser's default white, which is what a storage error
      // looks like.
      expect(response.body).toContain('<html lang="en">');
      expect(response.body).toContain('<title>Page not found - VilnaCRM</title>');
      expect(response.body).toContain('<meta name="robots" content="noindex">');
      expect(response.body).toMatch(/<h1[^>]*>[^<]+<\/h1>/);
      expect(response.body).toMatch(/<a href="\/"[^>]*>[^<]+<\/a>/);
      // `#1A1C1E` is `darkPrimary` in src/components/ui-color-theme; the edge cannot import
      // it, so the value is pinned here rather than left to drift silently against a theme
      // change. On the `#fff` ground it measures 16.8:1.
      expect(response.body).toContain('#1A1C1E');
      expect(response.body).not.toMatch(/<link\b|<script\b/);
    });

    test('sets the content-type header (guards #235: Safari downloads the 404)', () => {
      expect(response.headers['content-type']).toBeDefined();
      expect(response.headers['content-type']?.value).toBe('text/html; charset=utf-8');
    });

    test('sets a short cache-control header', () => {
      expect(response.headers['cache-control']?.value).toBe('public, max-age=60');
    });

    // CloudFront does NOT run the viewer-response function when a viewer-request function
    // short-circuits with its own response, so the synthetic 404 has to carry the security
    // headers inline (issue #377). `make lint-headers` enforces the same parity.
    test.each(Object.entries(policyHeaders))(
      'carries the %s security header from config/security-headers.json',
      (name, expected) => {
        expect(response.headers[name]?.value).toBe(expected);
      }
    );

    // The table above is generated from the policy file, so it would pass vacuously if a
    // header were dropped from the policy instead of from this handler. Naming the set
    // here keeps that removal visible in the diff.
    test('the policy the 404 is graded against is the full header set', () => {
      expect(Object.keys(policyHeaders).sort()).toEqual([
        'content-security-policy',
        'permissions-policy',
        'referrer-policy',
        'strict-transport-security',
        'x-content-type-options',
        'x-frame-options',
      ]);
    });

    test('denies every powerful feature on the synthetic 404 too', () => {
      expect(response.headers['permissions-policy']?.value).toBe(
        policyHeaders['permissions-policy']
      );
      expect(response.headers['permissions-policy']?.value).toContain('camera=()');
    });
  });

  describe('missing or malformed request', () => {
    test('returns the request unchanged when event.request is absent', () => {
      const result = handler({});
      expect(result).toBeUndefined();
      expect(vmConsole.log).toHaveBeenCalled();
    });

    // Each row walks one more level of the `request.headers.host.value` guard so every
    // short-circuit in that chain is exercised.
    test.each<CloudFrontRequest>([
      { uri: 42 },
      { uri: 42, headers: {} },
      { uri: 42, headers: { host: {} } },
      { uri: 42, headers: { host: { value: 'example.com' } } },
    ])('returns the request unchanged when uri is not a string (case %#)', request => {
      const result = handler({ request });
      expect(result).toBe(request);
      expect(vmConsole.log).toHaveBeenCalled();
    });
  });

  describe('defensive fallback', () => {
    test('returns the request unchanged when reading the uri throws', () => {
      // The handler reads `request.uri` twice: first in the `typeof request.uri` guard
      // (which runs BEFORE the try block) and again as `var uri = request.uri` inside the
      // try. To reach the try/catch, the getter must return a valid string on the first
      // read (so the guard passes) and throw on the second (so the throw lands inside the
      // try). Throwing on the first read instead would escape the guard uncaught.
      const request: CloudFrontRequest = {};
      let reads = 0;
      Object.defineProperty(request, 'uri', {
        configurable: true,
        get(): string {
          reads += 1;
          if (reads === 1) {
            return '/first-read-is-a-string';
          }
          throw new Error('boom');
        },
      });

      const result = handler({ request });

      expect(result).toBe(request);
      expect(reads).toBeGreaterThanOrEqual(2);
      expect(vmConsole.log).toHaveBeenCalled();
    });
  });
});
