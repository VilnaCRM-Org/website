import { test, expect, Locator } from '@playwright/test';

import { screenSizes, currentLanguage, timeoutDuration, placeholders } from './constants';
import { successResponse } from './graphqlMocks';

test.describe('Form Submission Visual Test', () => {
  for (const screen of screenSizes) {
    test(`Success notification - ${screen.name}`, async ({ page }) => {
      await page.goto('/');

      await page.waitForLoadState('networkidle');
      await page.evaluateHandle('document.fonts.ready');

      await page.setViewportSize({ width: screen.width, height: screen.height });

      await page.waitForFunction(() => document.readyState === 'complete');

      await page.route('**/graphql', route => successResponse(route, 200));

      const nameInput: Locator = page.getByPlaceholder(placeholders.name);
      await nameInput.scrollIntoViewIfNeeded();
      await nameInput.waitFor({ state: 'visible' });

      await nameInput.fill('John Doe');
      await page.getByPlaceholder(placeholders.email).fill('johndoe@example.com');
      await page.getByPlaceholder(placeholders.password).fill('SecurePassword123');
      await page.getByRole('checkbox').check();

      const submitButton: Locator = page.locator('button[type="submit"]');
      await submitButton.click();

      const successBox: Locator = page.locator('#success-box');
      await expect(successBox).toBeVisible();

      await page.waitForTimeout(timeoutDuration);

      await expect(page).toHaveScreenshot(`${currentLanguage}_${screen.name}_success.png`);
    });
  }
});
