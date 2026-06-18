// Jest loads environment modules with CommonJS require, so this file cannot use
// ESM import syntax.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSDOMEnvironment = require('jest-environment-jsdom').default;

/**
 * jsdom does not implement the Fetch API, but the integration layer runs the
 * real Apollo `HttpLink`, which needs `fetch` / `Response` / `Headers` /
 * `Request` to exist on the global.
 *
 * A Jest environment module executes in the Node realm — where those WHATWG
 * globals are real — so it can hand the genuine implementations to the jsdom
 * sandbox. This keeps integration tests parsing real `Response` objects (same
 * fidelity as the Node-environment API tests) instead of relying on a shim.
 *
 * The Node-environment tests (files with `@jest-environment node`) already have
 * these globals and bypass this environment entirely.
 */
class JsdomFetchEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);

    const target = this.global;
    const fetchGlobals = { fetch, Response, Request, Headers };

    Object.entries(fetchGlobals).forEach(([name, value]) => {
      if (typeof target[name] === 'undefined') {
        target[name] = value;
      }
    });

    if (typeof target.ReadableStream === 'undefined' && typeof ReadableStream !== 'undefined') {
      target.ReadableStream = ReadableStream;
    }
  }
}

module.exports = JsdomFetchEnvironment;
