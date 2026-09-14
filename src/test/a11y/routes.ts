/**
 * Every real route the accessibility gate scans (issue #317).
 *
 * The Lighthouse accessibility category score covers only two URLs
 * (`lighthouserc.desktop.js` / `lighthouserc.mobile.js`); this registry is the
 * route-level contract and must list every page under `pages/`. Adding a page
 * without adding it here is the drift this registry exists to prevent —
 * `src/test/unit/a11y/routes.test.ts` derives the route list from the
 * filesystem and fails when the two disagree. `routes.a11y.spec.ts` consumes
 * this registry; it does not police it.
 */
export interface A11yRoute {
  /** Path relative to the Playwright `baseURL`. */
  readonly path: string;
  /** Human-readable name used in the test title. */
  readonly name: string;
  /**
   * A locator for an element that proves the route finished rendering. The
   * scan waits for it, so an empty or still-loading page fails the gate
   * instead of passing with nothing to analyse.
   */
  readonly readySelector: string;
  /**
   * The language the route is exported in (WCAG 3.1.1). axe's `html-has-lang`
   * and `html-lang-valid` only check that a well-formed value exists; nothing
   * in axe checks that the value matches the content. The route gate asserts
   * this against `<html lang>` because the language is a function of the
   * pathname (`src/config/locales.ts`), and a route that renders English copy
   * under `lang="uk"` — which `/swagger` and `/en/docs/api` did before the
   * `/en` route landed — is read to a screen-reader user in the wrong voice.
   */
  readonly lang: string;
}

export const A11Y_ROUTES: readonly A11yRoute[] = [
  { path: '/', name: 'landing', readySelector: 'header', lang: 'uk' },
  { path: '/en', name: 'landing-en', readySelector: 'header', lang: 'en' },
  { path: '/swagger', name: 'swagger', readySelector: '.swagger-ui', lang: 'en' },
  { path: '/en/docs/api', name: 'api-docs-en', readySelector: 'h1', lang: 'en' },
  { path: '/offline', name: 'offline', readySelector: 'h1', lang: 'uk' },
];
