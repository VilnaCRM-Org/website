// Declaration shim for the sibling `lighthouserc.desktop.js`. Lighthouse CI
// loads its config as CommonJS `.js`, so it stays JavaScript; the ratchet guard
// in src/test/unit/lighthouse/lighthouse-config.test.ts imports it and narrows
// it through its own `LhciConfig` type, so `unknown` is the honest surface here.
declare const config: unknown;

export default config;
