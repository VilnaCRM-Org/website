import { test, expect, type Locator } from '@playwright/test';
import i18n from 'i18next';

import { INTERACTION_STATES } from '../../a11y/interaction-states';
import { scanInteractionState } from '../../a11y/scan-interaction-state';

import {
  getLocators,
  getUserEndpoints,
  GetUserEndpoints,
  TEST_CONSTANTS,
  GetSystemEndpoints,
  getSystemEndpoints,
  SwaggerLocators,
} from './utils';
import { UI_INTERACTION_DELAY } from './utils/constants';
import { collapseEndpoint } from './utils/helpers';

test.describe('Swagger Section', () => {
  let elements: SwaggerLocators;

  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_CONSTANTS.SWAGGER_PATH, { waitUntil: 'domcontentloaded' });
    elements = getLocators(page);
    await elements.apiDocumentation.waitFor({ state: 'visible', timeout: 15000 });
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
    await page.goto(TEST_CONSTANTS.SWAGGER_PATH, { waitUntil: 'domcontentloaded' });
    userEndpoints = getUserEndpoints(page);
    elements = getLocators(page);
    await elements.apiDocumentation.waitFor({ state: 'visible', timeout: 15000 });
  });
  test('system endpoints', async ({ page }) => {
    const systemEndpoints: GetSystemEndpoints = getSystemEndpoints(page);
    const endpoints: (keyof GetSystemEndpoints)[] = ['healthCheck', 'authorize', 'token'];

    for (const endpoint of endpoints) {
      await expect(systemEndpoints[endpoint]).toBeVisible();

      const currentEndpoint: Locator = systemEndpoints[endpoint];
      await currentEndpoint.click();

      await page.waitForTimeout(UI_INTERACTION_DELAY);

      const { body, sectionHeader, responses } = getBlocksInsideEndpoints(currentEndpoint);

      await expect(body).toBeVisible();
      await expect(sectionHeader).toBeVisible();
      await expect(responses).toBeVisible();

      await collapseEndpoint(currentEndpoint);

      await expect(body).not.toBeVisible();
    }
  });
  test('should display all User endpoints', async () => {
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

      await collapseEndpoint(currentEndpoint);

      await expect(body).not.toBeVisible();
    }
  });

  test('should have navigation working', async ({ page }) => {
    await elements.navigation.click();
    await expect(page).toHaveURL('/');
  });

  test('the back link is reachable and operable from the keyboard', async ({ page }) => {
    await elements.navigation.focus();
    await expect(elements.navigation).toBeFocused();

    await page.keyboard.press('Enter');

    await expect(page).toHaveURL('/');
  });
});

test.describe('Swagger schema failure', () => {
  const en: (key: string) => string = i18n.getFixedT('en');
  const SCHEMA_ROUTE: string = '**/swagger-schema.json';

  test('shows a localized alert with a working retry when the schema cannot be loaded', async ({
    page,
  }) => {
    await page.route(SCHEMA_ROUTE, route => route.abort());
    await page.goto(TEST_CONSTANTS.SWAGGER_PATH, { waitUntil: 'domcontentloaded' });

    // Scoped to the page body: Next's route announcer is a second, empty
    // `role="alert"` outside `main`.
    const alert: Locator = page.getByRole('main').getByRole('alert');
    await expect(alert).toHaveText(en('api_documentation.error.message'));
    const retry: Locator = page.getByRole('button', {
      name: en('api_documentation.error.retry'),
    });
    await expect(retry).toBeVisible();
    await expect(page.locator(TEST_CONSTANTS.SELECTORS.API_DOCUMENTATION)).toHaveCount(0);

    // The alert and the retry control only exist in this state, which no
    // initial-load scan ever sees (#369).
    await scanInteractionState(page, INTERACTION_STATES.swaggerLoadFailed);

    await page.unroute(SCHEMA_ROUTE);
    await retry.click();

    await expect(page.locator(TEST_CONSTANTS.SELECTORS.API_DOCUMENTATION)).toBeVisible({
      timeout: 15000,
    });
    await expect(alert).toHaveCount(0);
  });

  test('a retry that fails again hands focus to the retry control', async ({ page }) => {
    await page.route(SCHEMA_ROUTE, route => route.abort());
    await page.goto(TEST_CONSTANTS.SWAGGER_PATH, { waitUntil: 'domcontentloaded' });

    const retry: Locator = page.getByRole('button', {
      name: en('api_documentation.error.retry'),
    });
    await expect(retry).toBeVisible();
    await expect(retry).not.toBeFocused();

    await retry.click();

    await expect(retry).toBeFocused();
  });
});
