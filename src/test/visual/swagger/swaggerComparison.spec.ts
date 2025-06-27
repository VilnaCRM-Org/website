import { test, expect } from '@playwright/test';

import { screenSizes } from '../constants';

const currentLanguage: string = process.env.NEXT_PUBLIC_MAIN_LANGUAGE as string;

test.describe('Visual Tests', () => {
  for (const screen of screenSizes) {
    test.describe(`${screen.name}`, () => {
      test.use({ viewport: { width: screen.width, height: screen.height } });

      test(`${screen.name} visual`, async ({ page }) => {
        await page.goto('/swagger', { waitUntil: 'networkidle' });

        await page.waitForSelector('.swagger-ui', { state: 'attached' });

        await page.evaluateHandle(() => document.fonts.ready);

        await page.$$eval('.opblock-summary-control', ctrls =>
          ctrls.forEach(el => (el as HTMLElement).click())
        );
        await page.waitForFunction(() => {
          const total: number = document.querySelectorAll('.opblock-summary-control').length;
          const expanded: number = document.querySelectorAll('.opblock-body').length;
          return total === 0 || total === expanded;
        });

        await page.addStyleTag({
          content: '*{animation:none!important;transition:none!important}',
        });

        await expect(page).toHaveScreenshot(`${currentLanguage}_${screen.name}.png`, {
          fullPage: true,
        });
      });
    });
  }
});
