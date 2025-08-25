import { test, expect } from '@playwright/test';

import { screenSizes, timeoutDuration } from './constants';

const currentLanguage: string = process.env.NEXT_PUBLIC_MAIN_LANGUAGE as string;

test.describe('Visual Tests', () => {
 screenSizes.forEach((screen) => {
    test(`${screen.name} test`, async ({ page }) => {
     await page.goto('/', { waitUntil: 'load', timeout: 60000 });

      await page.waitForLoadState('networkidle');
      await page.evaluateHandle('document.fonts.ready');
      
     await page.waitForTimeout(1000);

      await page.waitForTimeout(timeoutDuration);

      const scrollHeight: number = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: screen.width, height: scrollHeight });

      await page.waitForTimeout(timeoutDuration);

      await page.setViewportSize({ width: screen.width, height: screen.height });

      await page.waitForTimeout(timeoutDuration);

      await expect(page).toHaveScreenshot(`${currentLanguage}_${screen.name}.png`, {
        fullPage: true,
        threshold: 0.2,
        mask: [page.locator('.dynamic-element')],
      });
    });
  });
});