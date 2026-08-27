/**
 * Unit coverage for the CloudFront Functions **viewer-response** handler
 * (`scripts/cloudfront_security_headers.js`), the enforcement point that attaches the
 * repository security-header policy to every production response (issue #377).
 *
 * Like `cloudfront-routing.test.ts`, the byte-identical ES5.1 artifact is loaded through
 * `node:fs` + `node:vm` with its real path as the vm `filename`, so the v8 coverage
 * provider attributes the executed code back to the source file — the `edge` layer
 * (`TEST_ENV=edge`) gates it at 100%.
 *
 * The assertions pin the behaviour the issue's acceptance criteria depend on:
 *   - every policy header lands on a PAGE response AND on an ASSET response (not just the
 *     synthetic 404 that used to be the only header-carrying branch);
 *   - the emitted values equal `config/security-headers.json`, so the deployed function and
 *     the reviewable policy cannot drift (the same parity `make lint-headers` enforces);
 *   - an origin response can never weaken a header (values are set, not merged);
 *   - the handler fails open rather than turning every request into a 502.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

interface CloudFrontResponse {
  statusCode?: number;
  statusDescription?: string;
  headers?: Record<string, { value: string }>;
}
type CloudFrontEvent = { request?: { uri?: string }; response?: unknown };
type CloudFrontHandler = (event: CloudFrontEvent) => CloudFrontResponse;

const REPO_ROOT: string = path.resolve(__dirname, '../../..');
const HANDLER_PATH: string = path.join(REPO_ROOT, 'scripts/cloudfront_security_headers.js');
const POLICY_PATH: string = path.join(REPO_ROOT, 'config/security-headers.json');

const policy: Record<string, string> = (
  JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8')) as { headers: Record<string, string> }
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
    throw new Error('cloudfront_security_headers.js did not expose a handler function');
  }
  return context.resolvedHandler;
}

const handler: CloudFrontHandler = loadHandler();

function pageResponse(): CloudFrontResponse {
  return {
    statusCode: 200,
    statusDescription: 'OK',
    headers: { 'content-type': { value: 'text/html; charset=utf-8' } },
  };
}

describe('cloudfront_security_headers handler', () => {
  beforeEach(() => {
    vmConsole.log.mockClear();
  });

  describe('policy coverage', () => {
    test('the policy pins the OWASP Secure Headers set the issue requires', () => {
      expect(Object.keys(policy).sort()).toEqual(
        [
          'content-security-policy',
          'referrer-policy',
          'strict-transport-security',
          'x-content-type-options',
          'x-frame-options',
        ].sort()
      );
      expect(policy['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(policy['x-frame-options']).toBe('DENY');
    });
  });

  describe.each([
    ['page', 'text/html; charset=utf-8'],
    ['asset', 'application/javascript'],
    ['image asset', 'image/svg+xml'],
  ])('%s response', (_label, contentType) => {
    test.each(Object.entries(policy))('emits %s: %s', (name, expected) => {
      const response: CloudFrontResponse = {
        statusCode: 200,
        statusDescription: 'OK',
        headers: { 'content-type': { value: contentType } },
      };

      const result = handler({ request: { uri: '/' }, response });

      expect(result.headers?.[name]?.value).toBe(expected);
      // The response is mutated in place and returned, as CloudFront expects.
      expect(result).toBe(response);
      expect(result.headers?.['content-type']?.value).toBe(contentType);
      expect(vmConsole.log).not.toHaveBeenCalled();
    });
  });

  test('creates the headers bag when the response carries none', () => {
    const response: CloudFrontResponse = { statusCode: 200, statusDescription: 'OK' };

    const result = handler({ request: { uri: '/' }, response });

    expect(result.headers).toBeDefined();
    for (const [name, expected] of Object.entries(policy)) {
      expect(result.headers?.[name]?.value).toBe(expected);
    }
  });

  test('overrides a weaker header supplied by the origin', () => {
    const response: CloudFrontResponse = {
      statusCode: 200,
      statusDescription: 'OK',
      headers: {
        'x-frame-options': { value: 'ALLOWALL' },
        'strict-transport-security': { value: 'max-age=0' },
      },
    };

    const result = handler({ request: { uri: '/' }, response });

    expect(result.headers?.['x-frame-options']?.value).toBe(policy['x-frame-options']);
    expect(result.headers?.['strict-transport-security']?.value).toBe(
      policy['strict-transport-security']
    );
  });

  describe('missing or malformed response', () => {
    test('returns the response unchanged when event.response is absent', () => {
      const result = handler({ request: { uri: '/' } });

      expect(result).toBeUndefined();
      expect(vmConsole.log).toHaveBeenCalled();
    });

    test('returns the response unchanged when it is not an object', () => {
      const result = handler({ request: { uri: '/' }, response: 'not-a-response' });

      expect(result).toBe('not-a-response');
      expect(vmConsole.log).toHaveBeenCalled();
    });
  });

  describe('defensive fallback', () => {
    test('fails open and returns the response when a header cannot be written', () => {
      // A frozen headers bag makes the assignment throw under "use strict"; the handler
      // must still return the response so CloudFront serves the page instead of a 502.
      const response: CloudFrontResponse = pageResponse();
      Object.freeze(response.headers);

      const result = handler({ request: { uri: '/' }, response });

      expect(result).toBe(response);
      expect(result.headers?.['x-frame-options']).toBeUndefined();
      expect(vmConsole.log).toHaveBeenCalled();
    });
  });
});
