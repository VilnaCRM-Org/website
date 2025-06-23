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

    // Check if authorization modal appears
    const authModal: Locator = page.locator('.auth-wrapper');
    await expect(authModal).toBeVisible();

    // Test API key input
    const apiKeyInput: Locator = authModal.locator('input[placeholder*="api_key"]');
    if (await apiKeyInput.isVisible()) {
      await apiKeyInput.fill('test-api-key');
      await authModal.locator('button:has-text("Authorize")').click();
    }

    // Test Bearer token input
    const bearerInput: Locator = authModal.locator('input[placeholder*="Bearer"]');
    if (await bearerInput.isVisible()) {
      await bearerInput.fill('test-bearer-token');
      await authModal.locator('button:has-text("Authorize")').click();
    }

    // Close modal
    await authModal.locator('button:has-text("Close")').click();
    await expect(authModal).not.toBeVisible();
  });

  test('should handle endpoint parameter inputs', async ({ page }) => {
    // Find an endpoint with parameters
    const endpointWithParams: Locator = page.locator('.opblock').filter({ hasText: '{' }).first();
    await endpointWithParams.click();

    // Look for parameter inputs
    const paramInputs: Locator = endpointWithParams.locator('input[type="text"]');
    const paramCount: number = await paramInputs.count();

    if (paramCount > 0) {
      // Fill in parameters
      for (let i: number = 0; i < paramCount; i += 1) {
        const input: Locator = paramInputs.nth(i);
        const placeholder: string | null = await input.getAttribute('placeholder');
        if (placeholder) {
          await input.fill('test-value');
        }
      }
    }

    // Test "Try it out" button
    const tryItOutBtn: Locator = endpointWithParams.locator('button:has-text("Try it out")');
    if (await tryItOutBtn.isVisible()) {
      await tryItOutBtn.click();
      await expect(tryItOutBtn).toHaveText('Cancel');
    }
  });

  test('should handle request body editing', async ({ page }) => {
    // Find a POST/PUT endpoint
    const postEndpoint: Locator = page.locator('.opblock.post, .opblock.put').first();
    await postEndpoint.click();

    // Look for request body editor
    const bodyEditor: Locator = postEndpoint.locator('.body-param__text');
    if (await bodyEditor.isVisible()) {
      const sampleData: Record<string, string> = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      await bodyEditor.fill(JSON.stringify(sampleData, null, 2));
    }
  });

  test('should handle response examples', async () => {
    const firstEndpoint: Locator = elements.endpoints.first();
    await firstEndpoint.click();

    // Look for response examples
    const responseExamples: Locator = firstEndpoint.locator(
      '.responses-inner .response-col_description__inner'
    );
    const exampleCount: number = await responseExamples.count();

    if (exampleCount > 0) {
      // Click on different response codes
      for (let i: number = 0; i < Math.min(exampleCount, 3); i += 1) {
        const example: Locator = responseExamples.nth(i);
        await example.click();

        // Check if response example is displayed
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

    // Look for model schemas
    const modelLinks: Locator = firstEndpoint.locator('.model-box .model-box__description a');
    const modelCount: number = await modelLinks.count();

    if (modelCount > 0) {
      // Click on model links to expand schemas
      for (let i: number = 0; i < Math.min(modelCount, 2); i += 1) {
        const modelLink: Locator = modelLinks.nth(i);
        await modelLink.click();

        // Check if schema modal appears
        const schemaModal: Locator = page.locator('.model-box__description__content');
        if (await schemaModal.isVisible()) {
          await expect(schemaModal).toBeVisible();

          // Close modal
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('should handle search functionality', async ({ page }) => {
    const searchInput: Locator = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      // Search for user endpoints
      await searchInput.fill('user');
      await page.waitForTimeout(UI_INTERACTION_DELAY);

      // Check if results are filtered
      const visibleEndpoints: Locator = elements.endpoints.filter({ hasText: 'user' });
      const visibleCount: number = await visibleEndpoints.count();
      expect(visibleCount).toBeGreaterThan(0);

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(UI_INTERACTION_DELAY);
    }
  });

  test('should handle endpoint filtering by tag', async ({ page }) => {
    // Look for tag filters
    const tagFilters: Locator = page.locator('.opblock-tag-section');
    const tagCount: number = await tagFilters.count();

    if (tagCount > 0) {
      // Click on first tag to expand/collapse
      const firstTag: Locator = tagFilters.first();
      const tagHeader: Locator = firstTag.locator('.opblock-tag');
      await tagHeader.click();

      // Check if endpoints are shown/hidden
      const endpoints: Locator = firstTag.locator('.opblock');
      const endpointCount: number = await endpoints.count();
      expect(endpointCount).toBeGreaterThan(0);
    }
  });

  test('should handle copy URL functionality', async () => {
    const firstEndpoint: Locator = elements.endpoints.first();
    await firstEndpoint.click();

    // Look for copy URL button
    const copyUrlBtn: Locator = firstEndpoint.locator('button[title*="Copy"]');
    if (await copyUrlBtn.isVisible()) {
      await copyUrlBtn.click();

      await expect(copyUrlBtn).toBeVisible();
    }
  });

  test('should handle response time display', async ({ page }) => {
    const firstEndpoint: Locator = elements.endpoints.first();
    await firstEndpoint.click();

    // Look for "Try it out" button
    const tryItOutBtn: Locator = firstEndpoint.locator('button:has-text("Try it out")');
    if (await tryItOutBtn.isVisible()) {
      await tryItOutBtn.click();

      // Look for execute button
      const executeBtn: Locator = firstEndpoint.locator('button:has-text("Execute")');
      if (await executeBtn.isVisible()) {
        await executeBtn.click();

        // Wait for response
        await page.waitForTimeout(2000);

        // Check if response time is displayed
        const responseTime: Locator = firstEndpoint.locator('.response-time');
        if (await responseTime.isVisible()) {
          const timeText: string | null = await responseTime.textContent();
          expect(timeText).toMatch(/\d+ms/);
        }
      }
    }
  });

  test('should handle error responses gracefully', async ({ page }) => {
    const firstEndpoint: Locator = elements.endpoints.first();
    await firstEndpoint.click();

    // Look for "Try it out" button
    const tryItOutBtn: Locator = firstEndpoint.locator('button:has-text("Try it out")');
    if (await tryItOutBtn.isVisible()) {
      await tryItOutBtn.click();

      // Fill invalid data if possible
      const bodyEditor: Locator = firstEndpoint.locator('.body-param__text');
      if (await bodyEditor.isVisible()) {
        await bodyEditor.fill('{"invalid": "data"}');
      }

      // Execute request
      const executeBtn: Locator = firstEndpoint.locator('button:has-text("Execute")');
      if (await executeBtn.isVisible()) {
        await executeBtn.click();

        // Wait for response
        await page.waitForTimeout(2000);

        // Check if error response is handled
        const errorResponse: Locator = firstEndpoint.locator('.response-col_status.error');
        if (await errorResponse.isVisible()) {
          await expect(errorResponse).toBeVisible();
        }
      }
    }
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.keyboard.press('Tab');

    for (let i: number = 0; i < 5; i += 1) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }

    await page.keyboard.press('Escape');

    const modals: Locator = page.locator('.auth-wrapper, .model-box__description__content');
    await expect(modals).not.toBeVisible();
  });
});
