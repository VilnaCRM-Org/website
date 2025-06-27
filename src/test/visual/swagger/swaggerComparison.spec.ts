import { test, expect } from '@playwright/test';

import { screenSizes, timeoutDuration } from '../constants';

const currentLanguage: string = process.env.NEXT_PUBLIC_MAIN_LANGUAGE as string;

test.describe('Visual Tests', () => {
  for (const screen of screenSizes) {
    test(`${screen.name} test`, async ({ page }) => {
      await page.goto('/swagger', { waitUntil: 'domcontentloaded' });

      await page.waitForSelector('.swagger-ui', { state: 'attached' });

      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);

      await page.waitForTimeout(timeoutDuration);

      await page.waitForFunction(() => {
        const swaggerUI:Element |null = document.querySelector('.swagger-ui');
        return swaggerUI && getComputedStyle(swaggerUI).opacity === '1';
      });

      const scrollHeight: number = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: screen.width, height: scrollHeight });

      await page.waitForLoadState('domcontentloaded');

      await expect(page).toHaveScreenshot(`${currentLanguage}_${screen.name}.png`, {
        fullPage: true,
      });
    });
  }
});
