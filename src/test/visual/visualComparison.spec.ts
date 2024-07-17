import { test, expect } from '@playwright/test';

import { screenSizes } from './constants';

const currentLanguage: string = process.env.NEXT_PUBLIC_MAIN_LANGUAGE as string;

test.describe('Visual Tests', () => {
  for (const screen of screenSizes) {
    test(`${screen.name} test`, async ({ page }) => {
      await page.goto('/');

      await page.waitForLoadState('networkidle');
      await page.evaluateHandle('document.fonts.ready');

      await page.waitForTimeout(3500);

      const scrollHeight: number = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: screen.width, height: scrollHeight });

      await page.waitForTimeout(3500);

      await page.setViewportSize({ width: screen.width, height: screen.height });

      await page.waitForTimeout(3500);

      await expect(page).toHaveScreenshot(`${screen.name}-${currentLanguage}.png`, {
        fullPage: true,
      });
    });
  }
});
