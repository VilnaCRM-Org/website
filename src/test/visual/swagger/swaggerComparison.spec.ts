import { test, expect } from '@playwright/test';

import { screenSizes, timeoutDuration } from '../constants';

const currentLanguage: string = process.env.NEXT_PUBLIC_MAIN_LANGUAGE as string;

test.describe('Visual Tests', () => {
  for (const screen of screenSizes) {
    test(`${screen.name} test`, async ({ page }) => {
      await page.goto('/swagger');

      await page.waitForLoadState('networkidle');
      await page.evaluateHandle('document.fonts.ready');
      await page.waitForSelector('.swagger-ui');

      await page.waitForTimeout(timeoutDuration);

      await page.evaluate(() => {
        document
          .querySelectorAll('.opblock-summary-control')
          ?.forEach(el => (el as HTMLElement).click());
      });

      await expect(page).toHaveScreenshot(`${currentLanguage}_${screen.name}.png`, {
        fullPage: true,
      });
    });
  }
});
