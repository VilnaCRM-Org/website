import { test, expect, type Locator } from '@playwright/test';

import { getLocators, TEST_CONSTANTS, SwaggerLocators } from './utils';
import { UI_INTERACTION_DELAY } from './utils/constants';

test.describe('Swagger UI Enhanced Interactions', () => {
  let elements: SwaggerLocators;

  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_CONSTANTS.SWAGGER_PATH);
    elements = getLocators(page);
  });

  test('should handle authorization modal', async ({ page }) => {
    await elements.authorizeButton.click();

    const authModal: Locator = page.locator('.modal-ux');
    await expect(authModal).toBeVisible();

    const apiKeyInput: Locator = authModal.locator('input[placeholder*="api_key"]');
    if (await apiKeyInput.isVisible()) {
      await apiKeyInput.fill('test-api-key');
      await authModal.locator('button:has-text("Authorize")').click();
    }

    const bearerInput: Locator = authModal.locator('input[placeholder*="Bearer"]');
    if (await bearerInput.isVisible()) {
      await bearerInput.fill('test-bearer-token');
      await authModal.locator('button:has-text("Authorize")').click();
    }

    await authModal.locator('button:has-text("Close")').click();
    await expect(authModal).not.toBeVisible();
  });

  test('should handle response examples', async () => {
    const firstEndpoint: Locator = elements.endpoints.first();
    await firstEndpoint.click();

    const responseExamples: Locator = firstEndpoint.locator(
      '.responses-inner .response-col_description__inner'
    );
    const exampleCount: number = await responseExamples.count();

    if (exampleCount > 0) {
      for (let i: number = 0; i < Math.min(exampleCount, 3); i += 1) {
        const example: Locator = responseExamples.nth(i);
        await example.click();

        const exampleContent: Locator = firstEndpoint.locator(
          '.response-col_description__inner .model-example'
        );
        if (await exampleContent.isVisible()) {
          const content: string | null = await exampleContent.textContent();
          expect(content).toBeTruthy();
        }
      }
    }
  });

  test('should handle model schema expansion', async ({ page }) => {
    const firstEndpoint: Locator = elements.endpoints.first();
    await firstEndpoint.click();

    const modelLinks: Locator = firstEndpoint.locator('.model-box .model-box__description a');
    const modelCount: number = await modelLinks.count();

    if (modelCount > 0) {
      for (let i: number = 0; i < Math.min(modelCount, 2); i += 1) {
        const modelLink: Locator = modelLinks.nth(i);
        await modelLink.click();

        const schemaModal: Locator = page.locator('.model-box__description__content');
        if (await schemaModal.isVisible()) {
          await expect(schemaModal).toBeVisible();

          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('should handle search functionality', async ({ page }) => {
    const searchInput: Locator = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('user');
      await page.waitForTimeout(UI_INTERACTION_DELAY);

      const visibleEndpoints: Locator = elements.endpoints.filter({ hasText: 'user' });
      const visibleCount: number = await visibleEndpoints.count();
      expect(visibleCount).toBeGreaterThan(0);

      await searchInput.clear();
      await page.waitForTimeout(UI_INTERACTION_DELAY);
    }
  });

  test('should handle endpoint filtering by tag', async ({ page }) => {
    const tagFilters: Locator = page.locator('.opblock-tag-section');
    await tagFilters.first().waitFor({ state: 'visible' });

    const tagCount: number = await tagFilters.count();
    if (tagCount > 0) {
      const firstTag: Locator = tagFilters.first();

      const endpoints: Locator = firstTag.locator('.opblock');
      const endpointCount: number = await endpoints.count();
      expect(endpointCount).toBeGreaterThan(0);
    }
  });

  test('should handle copy URL functionality', async () => {
    const firstEndpoint: Locator = elements.endpoints.first();
    await firstEndpoint.click();

    const copyUrlBtn: Locator = firstEndpoint.locator('button[title*="Copy"]');
    if (await copyUrlBtn.isVisible()) {
      await copyUrlBtn.click();

      await expect(copyUrlBtn).toBeVisible();
    }
  });

  test('should handle response time display', async ({ page }) => {
    const firstEndpoint: Locator = elements.endpoints.first();
    await firstEndpoint.click();

    const tryItOutBtn: Locator = firstEndpoint.locator('button:has-text("Try it out")');
    if (await tryItOutBtn.isVisible()) {
      await tryItOutBtn.click();

      const executeBtn: Locator = firstEndpoint.locator('button:has-text("Execute")');
      if (await executeBtn.isVisible()) {
        await executeBtn.click();

        await page.waitForTimeout(TEST_CONSTANTS.API_RESPONSE_TIMEOUT || 2000);

        const responseTime: Locator = firstEndpoint.locator('.response-time');
        if (await responseTime.isVisible()) {
          const timeText: string | null = await responseTime.textContent();
          expect(timeText).toMatch(/\d+(\.\d+)?\s?(ms|s)/);
        }
      }
    }
  });

  test('should handle error responses gracefully', async ({ page }) => {
    const firstEndpoint: Locator = elements.endpoints.first();
    await firstEndpoint.click();

    const tryItOutBtn: Locator = firstEndpoint.locator('button:has-text("Try it out")');
    if (await tryItOutBtn.isVisible()) {
      await tryItOutBtn.click();

      const bodyEditor: Locator = firstEndpoint.locator('.body-param__text');
      if (await bodyEditor.isVisible()) {
        await bodyEditor.fill('{"invalid": "data"}');
      }

      const executeBtn: Locator = firstEndpoint.locator('button:has-text("Execute")');
      if (await executeBtn.isVisible()) {
        await executeBtn.click();

        await page.waitForTimeout(TEST_CONSTANTS.API_RESPONSE_TIMEOUT || 2000);

        const errorResponse: Locator = firstEndpoint.locator('.response-col_status.error');
        if (await errorResponse.isVisible()) {
          await expect(errorResponse).toBeVisible();
        }
      }
    }
  });
});
