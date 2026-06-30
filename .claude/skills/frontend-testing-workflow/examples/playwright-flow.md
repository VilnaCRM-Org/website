# Playwright Flow Example

An end-to-end spec (`src/test/e2e/`, run with `make test-e2e`) that drives the
real app against the Mockoon backend. Locators are user-facing; a stable option
object keeps the accessible-name query readable and prettier-friendly.

```ts
import { test, expect } from '@playwright/test';

const ctaOption: { name: RegExp } = { name: /try it out/i };

test.describe('Sign-up entry point', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('the header CTA opens the sign-up form', async ({ page }) => {
    await page.locator('header').getByRole('link', ctaOption).click();
    await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();
  });
});
```

## Driving a failure path

For the negative scenario, override the GraphQL response for this spec only with
`page.route`, then `unroute` so it does not leak into later assertions:

```ts
test('shows a server-error notification when the API fails', async ({ page }) => {
  const handler = async route =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ errors: [{ message: 'Internal Server Error' }] }),
    });

  await page.route('**/graphql', handler);
  await page.goto('/');
  // ... fill and submit the sign-up form ...
  await expect(page.getByText(/something went wrong/i)).toBeVisible();
  await page.unroute('**/graphql', handler);
});
```

Reach for `locator()`/CSS only for structure with no accessible name (a wrapping
`section`, or `button[type="submit"]`). Add an accessible name to the component
before adding a test-only attribute.
