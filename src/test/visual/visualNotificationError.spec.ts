import { test, Locator, expect, Route } from '@playwright/test';

import { currentLanguage, placeholders, screenSizes } from '@/test/visual/constants';

import { errorResponse, ErrorResponseProps } from './graphqlMocks';

const serverErrorResponse: ErrorResponseProps = {
  status: 500,
  message: 'Internal Server Error',
  code: 'INTERNAL_SERVER_ERROR',
};

test.describe('Form Submission Server Error Test', () => {
  for (const screen of screenSizes) {
    test(`Server error notification - ${screen.name}`, async ({ page }) => {
     await page.goto('/', { waitUntil: 'load', timeout: 60000 });

      await page.waitForLoadState('networkidle');
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      await page.setViewportSize({ width: screen.width, height: screen.height });

      await page.waitForFunction(() => document.readyState === 'complete');

      const routeHandler: (route: Route) => Promise<void> = async (route: Route): Promise<void> =>
        errorResponse(route, serverErrorResponse);

      await page.route('**/graphql', routeHandler);

      const nameInput: Locator = page.getByPlaceholder(placeholders.name);
      await nameInput.scrollIntoViewIfNeeded();
      await nameInput.waitFor({ state: 'visible' });

      await page.getByPlaceholder(placeholders.name).fill('John Doe');
      await page.getByPlaceholder(placeholders.email).fill('john@example.com');
      await page.getByPlaceholder(placeholders.password).fill('SecurePassword123');
      await page.getByRole('checkbox').check();

      const submitButton: Locator = page.locator('button[type="submit"]');
      await submitButton.click();

      const errorBox: Locator = page.locator('[aria-invalid="true"]');
      await expect(errorBox).toBeVisible();

      await expect(submitButton).toBeEnabled();

      await page.waitForFunction(
        () => !document.querySelector('[aria-invalid="true"]')?.classList.contains('animating')
      );

      await expect(page).toHaveScreenshot(`${currentLanguage}_${screen.name}_error.png`);

      await page.unroute('**/graphql', routeHandler);
    });
  }
});
