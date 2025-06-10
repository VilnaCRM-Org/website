import { test, expect } from '@playwright/test';

import { screenSizes } from '../constants';

const currentLanguage: string = process.env.NEXT_PUBLIC_MAIN_LANGUAGE as string;

test.describe('Visual Tests', () => {
  for (const screen of screenSizes) {
    test(`${screen.name} test`, async ({ page }) => {
      await page.setViewportSize({ width: screen.width, height: screen.height });
      await page.goto('/swagger');

      await page.waitForLoadState('networkidle');
      await page.evaluateHandle('document.fonts.ready');
      await page.waitForSelector('.swagger-ui');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForSelector('.opblock-summary-control', { state: 'visible' });

      await page.evaluate(() => {
        const controls: NodeListOf<Element> = document.querySelectorAll('.opblock-summary-control');
        controls.forEach(el => (el as HTMLElement).click());
      });
      await page.waitForFunction(() => {
        const controls: NodeListOf<Element> = document.querySelectorAll('.opblock-summary-control');
        return (
          controls.length > 0 &&
          Array.from(controls).every(el => getComputedStyle(el).display !== 'none')
        );
      });
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(`${currentLanguage}_${screen.name}.png`, {
        fullPage: true,
      });
    });
  }
});
