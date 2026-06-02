import { test, expect } from '@playwright/test';

import { currentLanguage, screenSizes, timeoutDuration } from './constants';

test.describe('Visual Tests', () => {
  screenSizes.forEach(screen => {
    test(`${screen.name} test`, async ({ page, browserName }) => {
      const hasKnownWebkitTextDiff =
        browserName === 'webkit' &&
        ['full', 'desktop', 'desktop2', 'tablet', 'tablet2'].includes(screen.name);

      await page.goto('/');

      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);

      await page.waitForTimeout(timeoutDuration);

      const scrollHeight: number = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: screen.width, height: scrollHeight });

      await page.waitForTimeout(timeoutDuration);

      await page.setViewportSize({ width: screen.width, height: screen.height });

      await page.waitForTimeout(timeoutDuration);
      await page.evaluate(() => document.fonts.ready);

      await expect(page).toHaveScreenshot(`${currentLanguage}_${screen.name}.png`, {
        fullPage: true,
        ...(hasKnownWebkitTextDiff ? { maxDiffPixels: 2 } : {}),
      });
    });
  });
});
