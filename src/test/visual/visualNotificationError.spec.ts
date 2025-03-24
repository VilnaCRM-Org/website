import { test, Locator, expect } from '@playwright/test';

import {
  currentLanguage,
  placeholders,
  screenSizes,
  timeoutDuration,
} from '@/test/visual/constants';

import { errorResponse, ErrorResponseProps } from './graphqlMocks';

const serverErrorResponse: ErrorResponseProps = {
  status: 500,
  message: 'Internal Server Error',
  code: 'INTERNAL_SERVER_ERROR',
};

test.describe('Form Submission Server Error Test', () => {
  for (const screen of screenSizes) {
    test(`Server error notification - ${screen.name}`, async ({ page }) => {
      await page.goto('/');

      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);

      await page.setViewportSize({ width: screen.width, height: screen.height });

      await page.waitForFunction(() => document.readyState === 'complete');

      await page.route('**/graphql', route => errorResponse(route, serverErrorResponse));

      const nameInput: Locator = page.getByPlaceholder(placeholders.name);
      await nameInput.scrollIntoViewIfNeeded();
      await nameInput.waitFor({ state: 'visible' });

      await page.getByPlaceholder(placeholders.name).fill('John Doe');
      await page.getByPlaceholder(placeholders.email).fill('john@example.com');
      await page.getByPlaceholder(placeholders.password).fill('SecurePassword123');
      await page.getByRole('checkbox').check();

      const submitButton: Locator = page.locator('button[type="submit"]');
      await submitButton.click();

      const errorBox: Locator = page.locator('#error-box');
      await expect(errorBox).toBeVisible();

      await page.waitForTimeout(timeoutDuration);

      await expect(page).toHaveScreenshot(`${currentLanguage}_${screen.name}_error.png`);
    });
  }
});
