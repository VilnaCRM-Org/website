import { test, expect } from '@playwright/test';

import { screenSizes } from '../constants';

const currentLanguage: string = process.env.NEXT_PUBLIC_MAIN_LANGUAGE as string;

test.describe('Visual Tests', () => {
  for (const screen of screenSizes) {
    test(`${screen.name} test`, async ({ page }) => {
      await page.goto('/swagger');

      await test.step('Navigate and wait for initial load', async () => {
        await page.goto('/swagger', { waitUntil: 'networkidle' });
        await page.waitForLoadState('domcontentloaded');
      });

      await test.step('Wait for critical elements', async () => {
        await Promise.all([
          page.evaluateHandle('document.fonts.ready'),
          page.waitForSelector('.swagger-ui', { state: 'attached' }),
          page.waitForSelector('.opblock-summary-control', { state: 'visible' }),
        ]);
      });
      await test.step('Expand all Swagger operations', async () => {
        await page.evaluate(() => {
          const controls: NodeListOf<Element> = document.querySelectorAll(
            '.opblock-summary-control'
          );
          controls.forEach(el => (el as HTMLElement).click());
        });

        await page.waitForFunction(() => {
          const controls: NodeListOf<Element> = document.querySelectorAll(
            '.opblock-summary-control'
          );
          const expanded: NodeListOf<Element> = document.querySelectorAll('.opblock-body');
          return controls.length > 0 && expanded.length === controls.length;
        });
      });

      await test.step('Ensure stable state for screenshot', async () => {
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => {
          const opblocks: NodeListOf<Element> = document.querySelectorAll('.opblock');
          return (
            opblocks.length > 0 &&
            Array.from(opblocks).every(
              block =>
                (block.querySelector('.opblock-body') && !block.classList.contains('is-open')) ||
                block.querySelector('.responses-wrapper')
            )
          );
        });
      });
      const scrollHeight: number = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: screen.width, height: scrollHeight });

      await page.waitForLoadState('domcontentloaded');

      await test.step('Take screenshot', async () => {
        await expect(page).toHaveScreenshot(`${currentLanguage}_${screen.name}.png`, {
          fullPage: true,
        });
      });
    });
  }
});
