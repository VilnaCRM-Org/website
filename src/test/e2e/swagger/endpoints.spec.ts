import { test, expect, type Locator } from '@playwright/test';

import {
  getLocators,
  getUserEndpoints,
  GetUserEndpoints,
  TEST_CONSTANTS,
  GetSystemEndpoints,
  getSystemEndpoints,
  SwaggerLocators,
} from './utils';

test.describe('Swagger Section', () => {
  let elements: SwaggerLocators;

  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_CONSTANTS.SWAGGER_PATH);
    elements = getLocators(page);
  });

  test('should display main Swagger UI components', async () => {
    await expect(elements.apiDocumentation).toBeVisible();
    await expect(elements.navigation).toBeVisible();
    await expect(elements.authorizeButton).toBeVisible();
    await expect(elements.schemeContainer).toBeVisible();
  });

  test('should display API endpoints', async () => {
    await elements.endpoints.first().waitFor({ state: 'visible' });
    const endpointsCount: number = await elements.endpoints.count();

    for (let i: number = 0; i < endpointsCount; i += 1) {
      await expect(elements.endpoints.nth(i)).toBeVisible();
    }

    expect(endpointsCount).toBeGreaterThanOrEqual(9);
  });

  test('should expand endpoint details when clicked', async () => {
    const firstEndpoint: Locator = elements.endpoints.first();
    await firstEndpoint.click();

    const endpointContent: Locator = firstEndpoint.locator('.opblock-body');
    await expect(endpointContent).toBeVisible();
  });
});

type BlocksInsideEndpoints = Record<
  'description' | 'sectionHeader' | 'responses' | 'body',
  Locator
>;

const getBlocksInsideEndpoints: (element: Locator) => BlocksInsideEndpoints = (
  element: Locator
): BlocksInsideEndpoints => ({
  body: element.locator('.opblock-body'),
  description: element.locator('.opblock-description-wrapper').first(),
  sectionHeader: element.locator('.opblock-section-header').first(),
  responses: element.locator('.responses-wrapper .responses-inner').first(),
});

test.describe('User Section', () => {
  let userEndpoints: GetUserEndpoints;
  let elements: SwaggerLocators;

  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_CONSTANTS.SWAGGER_PATH);
    userEndpoints = getUserEndpoints(page);
    elements = getLocators(page);
  });
  test('system endpoints', async ({ page }) => {
    const systemEndpoints: GetSystemEndpoints = getSystemEndpoints(page);
    const endpoints: (keyof GetSystemEndpoints)[] = ['healthCheck', 'authorize', 'token'];

    for (const endpoint of endpoints) {
      await expect(systemEndpoints[endpoint]).toBeVisible();

      const currentEndpoint: Locator = systemEndpoints[endpoint];
      await currentEndpoint.click();

      await page.waitForTimeout(100);

      const { body, sectionHeader, responses } = getBlocksInsideEndpoints(currentEndpoint);

      await expect(body).toBeVisible();
      await expect(sectionHeader).toBeVisible();
      await expect(responses).toBeVisible();

      await currentEndpoint.locator('.opblock-summary').click();

      await page.waitForTimeout(100);

      await expect(body).not.toBeVisible();
    }
  });
  test('should display all User endpoints', async ({ page }) => {
    const endpoints: (keyof GetUserEndpoints)[] = [
      'getCollection',
      'create',
      'createBatch',
      'confirm',
      'getById',
      'updateById',
      'deleteById',
      'patchById',
      'resendConfirmation',
    ];

    for (const endpoint of endpoints) {
      await expect(userEndpoints[endpoint]).toBeVisible();

      const currentEndpoint: Locator = userEndpoints[endpoint];
      await currentEndpoint.click();

      const { body, description, sectionHeader, responses } =
        getBlocksInsideEndpoints(currentEndpoint);

      await expect(body).toBeVisible();
      await expect(description).toBeVisible();
      await expect(sectionHeader).toBeVisible();
      await expect(responses).toBeVisible();

      await currentEndpoint.locator('.opblock-summary').click();

      await page.waitForTimeout(100);

      await expect(body).not.toBeVisible();
    }
  });

  test('should have navigation working', async ({ page }) => {
    await elements.navigation.click();
    await expect(page).toHaveURL('/');
  });
});
