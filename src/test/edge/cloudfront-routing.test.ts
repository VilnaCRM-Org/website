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

const HANDLER_PATH: string = path.resolve(__dirname, '../../../scripts/cloudfront_routing.js');

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

  describe('exact route rewrites', () => {
    test.each([
      ['/', '/index.html'],
      ['/about', '/about/index.html'],
      ['/about/', '/about/index.html'],
      ['/en', '/en/index.html'],
      ['/en/', '/en/index.html'],
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

  describe('asset paths (last segment has an extension)', () => {
    test.each(['/style.css', '/nested/app.js', '/en/logo.svg', '/deep/dir/photo.png'])(
      'leaves %s untouched',
      uri => {
        const request: CloudFrontRequest = { uri };
        const result = handler({ request });
        expect(result).toBe(request);
        expect((result as CloudFrontRequest).uri).toBe(uri);
      }
    );
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
      expect(response.body).toContain('404');
      expect(response.body).toContain('<!DOCTYPE html>');
    });

    test('sets the content-type header (guards #235: Safari downloads the 404)', () => {
      expect(response.headers['content-type']).toBeDefined();
      expect(response.headers['content-type']?.value).toBe('text/html; charset=utf-8');
    });

    test('sets a short cache-control header', () => {
      expect(response.headers['cache-control']?.value).toBe('public, max-age=60');
    });
  });

  describe('unknown nested path (more than one segment)', () => {
    test.each(['/a/b', '/blog/post/extra', '/one/two/three'])(
      'passes %s through unchanged',
      uri => {
        const request: CloudFrontRequest = { uri };
        const result = handler({ request });
        expect(result).toBe(request);
        expect((result as CloudFrontRequest).uri).toBe(uri);
      }
    );
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
