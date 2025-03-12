import {test, expect, Locator} from '@playwright/test';

import {screenSizes, currentLanguage, timeoutDuration, placeholders} from '@/test/visual/constants';

test.describe('Form Submission Visual Test', () => {
  for (const screen of screenSizes) {
    test(`Success notification - ${screen.name}`, async ({ page }) => {
      await page.goto('/');

      await page.waitForLoadState('networkidle');
      await page.evaluateHandle('document.fonts.ready');

      await page.setViewportSize({ width: screen.width, height: screen.height });


      await page.waitForFunction(() => document.readyState === 'complete');


      const nameInput:Locator = page.getByPlaceholder(placeholders.name);
      await nameInput.scrollIntoViewIfNeeded();
      await page.waitForTimeout(timeoutDuration);

      await nameInput.fill('John Doe');
      await page.getByPlaceholder(placeholders.email).fill('johndoe@example.com');
      await page.getByPlaceholder(placeholders.password).fill('SecurePassword123');
      await page.getByRole('checkbox').check();

      await page.click('button[type="submit"]');

      const successBox: Locator = page.getByTestId('success-box');
      await expect(successBox).toBeVisible();

      await page.waitForTimeout(timeoutDuration);

      await expect(page).toHaveScreenshot(`${currentLanguage}_${screen.name}_success.png`);
    });
  }
});
