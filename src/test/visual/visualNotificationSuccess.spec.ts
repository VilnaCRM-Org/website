/* eslint-disable no-restricted-syntax */
import { test, expect, Locator, Route } from '@playwright/test';

import { screenSizes, currentLanguage, placeholders } from './constants';
import { successResponse } from './graphqlMocks';

test.describe('Form Submission Visual Test', () => {
  for (const screen of screenSizes) {
    test(`Success notification - ${screen.name}`, async ({ page }) => {
      await page.goto('/');

      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);

      await page.setViewportSize({ width: screen.width, height: screen.height });

      await page.waitForFunction(() => document.readyState === 'complete');

      const routeHandler: (route: Route) => Promise<void> = async (route: Route): Promise<void> => {
        await successResponse(route, 200);
      };
      await page.route('**/graphql', routeHandler);

      const nameInput: Locator = page.getByPlaceholder(placeholders.name);
      await nameInput.scrollIntoViewIfNeeded();
      await nameInput.waitFor({ state: 'visible' });

      await nameInput.fill('John Doe');
      await page.getByPlaceholder(placeholders.email).fill('johndoe@example.com');
      await page.getByPlaceholder(placeholders.password).fill('SecurePassword123');
      await page.getByRole('checkbox').check();

      const submitButton: Locator = page.locator('button[type="submit"]');
      await submitButton.click();

      const successBox: Locator = page.locator('[aria-label="success"]');
      await expect(successBox).toBeVisible();

      const imagesWithAlt: Locator = successBox.locator('img[alt]');
      await expect(imagesWithAlt).toHaveCount(3);

      await page.evaluate(() =>
        Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => null)))
      );

      await expect(page).toHaveScreenshot(`${currentLanguage}_${screen.name}_success.png`);

      await page.unroute('**/graphql', routeHandler);
    });
  }
});
