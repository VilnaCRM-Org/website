import { test, Request, Locator, expect } from '@playwright/test';

import {
  currentLanguage,
  placeholders,
  screenSizes,
  timeoutDuration,
} from '@/test/visual/constants';

interface GraphQLRequestPayload {
  operationName?: string;
  variables?: Record<string, unknown>;
  query?: string;
}

test.describe('Form Submission Server Error Test', () => {
  for (const screen of screenSizes) {
    test(`Server error notification - ${screen.name}`, async ({ page }) => {
      await page.route('**/graphql', async route => {
        const request: Request = route.request();
        const postData: GraphQLRequestPayload = await request.postDataJSON();

        if (postData?.query?.includes('mutation AddUser')) {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              errors: [{
                message: 'Internal Server Error',
                extensions: { code: 'INTERNAL_SERVER_ERROR' }
              }],
            }),
          });
        } else {
          await route.continue();
        }
      });
      await page.goto('/');

      await page.waitForLoadState('networkidle');
      await page.evaluateHandle('document.fonts.ready');
      await page.setViewportSize({ width: screen.width, height: screen.height });

      await page.waitForFunction(() => document.readyState === 'complete');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(timeoutDuration);

      await page.getByPlaceholder(placeholders.name).fill('John Doe');
      await page.getByPlaceholder(placeholders.email).fill('john@example.com');
      await page.getByPlaceholder(placeholders.password).fill('SecurePassword123');
      await page.getByRole('checkbox').check();

      const submitButton: Locator = page.locator('button[type="submit"]');
      await submitButton.click();

      await page.waitForTimeout(timeoutDuration);

      const serverErrorBox: Locator = page.getByTestId('error-box');
      await expect(serverErrorBox).toBeVisible();

      await page.waitForTimeout(timeoutDuration);
      await expect(page).toHaveScreenshot(`${currentLanguage}_${screen.name}_error.png`);
    });
  }
});
