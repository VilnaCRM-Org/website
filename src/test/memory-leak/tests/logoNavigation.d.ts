// Declaration shim for the sibling memlab scenario `logoNavigation.js`. memlab
// loads scenario files directly as JavaScript, so it stays `.js`; this exposes
// the scenario surface that src/test/unit/logoNavigationMemoryLeak.test.ts
// exercises (its `url()` and `action()` steps) under `allowJs: false`.
declare const scenario: {
  url(): string;
  action(page: unknown): Promise<void>;
  back(page: unknown): Promise<void>;
};

export default scenario;
