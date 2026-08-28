// Declaration shim for the sibling `stryker.config.mjs`. Stryker requires its
// config as an ESM `.mjs` module, so it cannot become TypeScript; this exposes
// just the `thresholds.break` field that scripts/ci/merge-mutation-reports.ts
// reads back to re-enforce the canonical mutation-score gate.
declare const config: {
  thresholds?: {
    break?: number | null;
  };
};

export default config;
