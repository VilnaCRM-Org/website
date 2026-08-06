import { test, type Page } from '@playwright/test';

import { expectFocusable, expectKeyboardOperable } from './keyboard';
import { A11Y_ROUTES, type A11yRoute } from './routes';
import { scanRoute } from './scan-route';

/**
 * Route-level accessibility gate (issue #317).
 *
 * Every route in the registry is scanned against WCAG 2.1 AA per rule and
 * walked with the keyboard. Assertions are unconditional by design: there is
 * no `if (count > 0)` or `if (isVisible())` wrapper anywhere in this file, so
 * a route that fails to render fails the gate instead of passing with nothing
 * to assert.
 */

/**
 * Swagger UI hydrates from a fetched spec, so allow more than the default —
 * but stay below Playwright's per-test timeout so an unrendered route reports
 * "the ready selector never appeared" rather than a bare test timeout.
 */
const ROUTE_READY_TIMEOUT: number = 20_000;

/**
 * The site chrome is composed in `pages/_app.tsx` through
 * `next/dynamic({ ssr: false })`, so it exists only after hydration. Waiting for
 * it on every route is what makes the scans deterministic: a page whose own
 * ready selector is server-rendered (`/en/docs/api` is just an `h1`) would
 * otherwise be scanned during the window before any interactive control has
 * mounted, and the keyboard sweep would intermittently find nothing to walk.
 */
const CHROME_SELECTOR: string = 'header';

async function openRoute(page: Page, route: A11yRoute): Promise<void> {
  await page.goto(route.path, { waitUntil: 'domcontentloaded' });

  await page
    .locator(CHROME_SELECTOR)
    .first()
    .waitFor({ state: 'visible', timeout: ROUTE_READY_TIMEOUT });

  await page
    .locator(route.readySelector)
    .first()
    .waitFor({ state: 'visible', timeout: ROUTE_READY_TIMEOUT });
}

test.describe('route accessibility', () => {
  A11Y_ROUTES.forEach(route => {
    test(`${route.name} (${route.path}) has no WCAG 2.1 AA violations`, async ({ page }) => {
      test.slow();

      await openRoute(page, route);

      await scanRoute(page, route.path);
    });

    test(`${route.name} (${route.path}) is keyboard operable`, async ({ page }) => {
      test.slow();

      await openRoute(page, route);

      await expectKeyboardOperable(page);
    });

    test(`${route.name} (${route.path}) exposes a focusable first control`, async ({ page }) => {
      // `openRoute` may wait ROUTE_READY_TIMEOUT for swagger to hydrate, which
      // is close enough to Playwright's default test timeout to report a bare
      // timeout instead of "the ready selector never appeared".
      test.slow();

      await openRoute(page, route);

      await expectFocusable(page.getByRole('link').first());
    });
  });
});
