import { test, expect, type Locator } from '@playwright/test';

import { getLocators, TEST_CONSTANTS, SwaggerLocators, USER_ENDPOINTS } from './utils';
import { locators } from './utils/locators';

/**
 * Swagger UI interaction coverage.
 *
 * Every assertion here is unconditional (issue #317). This file previously
 * wrapped its assertions in `if (count > 0)` / `if (await x.isVisible())`
 * guards, so a missing element skipped the assertion and the test still
 * reported green — several of them asserted nothing at all, because the
 * elements they guarded on (an `api_key` input, a search box, a
 * `button[title*="Copy"]`, `.model-box__description` links, `.response-time`)
 * are not rendered by this Swagger configuration. The tests below target what
 * the page actually renders, and fail when it stops rendering it.
 */

/** Swagger hydrates from a fetched spec, so the first paint needs headroom. */
const SWAGGER_READY_TIMEOUT: number = 20_000;

/** Executing against the Mockoon-backed API is a real round trip. */
const EXECUTE_TIMEOUT: number = TEST_CONSTANTS.API_RESPONSE_TIMEOUT * 5;

test.describe('Swagger UI Enhanced Interactions', () => {
  let elements: SwaggerLocators;

  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_CONSTANTS.SWAGGER_PATH, { waitUntil: 'domcontentloaded' });
    elements = getLocators(page);
    await elements.apiDocumentation
      .first()
      .waitFor({ state: 'visible', timeout: SWAGGER_READY_TIMEOUT });
  });

  test('should handle authorization modal', async ({ page }) => {
    await elements.authorizeButton.first().click();

    const authModal: Locator = page.locator('.modal-ux');
    await expect(authModal).toBeVisible();

    // The pinned spec declares a single OAuth2 authorizationCode flow, so the
    // modal renders client credential fields — not the api_key / Bearer inputs
    // the guarded version looked for and never found.
    const clientId: Locator = authModal.locator('#client_id_authorizationCode');
    const clientSecret: Locator = authModal.locator('#client_secret_authorizationCode');

    await expect(clientId).toBeVisible();
    await expect(clientSecret).toBeVisible();

    await clientId.fill('test-client-id');
    await clientSecret.fill('test-client-secret');

    await expect(clientId).toHaveValue('test-client-id');
    await expect(clientSecret).toHaveValue('test-client-secret');

    // Both credential fields must be labelled, or the dialog is unusable with
    // a screen reader.
    await expect(authModal.locator('label[for="client_id_authorizationCode"]')).toBeVisible();
    await expect(authModal.locator('label[for="client_secret_authorizationCode"]')).toBeVisible();

    await authModal.locator('button:has-text("Close")').click();
    await expect(authModal).not.toBeVisible();
  });

  test('should handle response examples', async ({ page }) => {
    // Pin the endpoint rather than taking whichever renders first: document
    // order is a property of the upstream spec, not of this behaviour.
    const endpoint: Locator = page.locator(USER_ENDPOINTS.GET_COLLECTION);
    await endpoint.click();

    const documentedResponses: Locator = endpoint.locator(
      '.responses-inner .response-col_description__inner'
    );

    await expect(documentedResponses.first()).toBeVisible();
    expect(await documentedResponses.count()).toBeGreaterThan(0);

    const exampleValue: Locator = endpoint.locator('.responses-inner .model-example').first();
    await expect(exampleValue).toBeVisible();

    // `.microlight` is the rendered-code container the rest of the swagger
    // suite uses. Assert it rendered a JSON document rather than asserting on
    // a field name, which would couple this gate to the pinned contract.
    const renderedExample: Locator = exampleValue.locator('.microlight').first();
    await expect(renderedExample).toBeVisible();
    await expect(renderedExample).toHaveText(/^\s*[[{]/);
  });

  test('should handle model schema expansion', async ({ page }) => {
    const endpoint: Locator = page.locator(USER_ENDPOINTS.GET_COLLECTION);
    await endpoint.click();

    // The response pane exposes Example Value / Schema tabs; switching to
    // Schema is the model expansion this test is named for.
    const examplePane: Locator = endpoint.locator('.responses-inner .model-example').first();
    const exampleTab: Locator = examplePane.getByRole('tab', { name: 'Example Value' });
    const schemaTab: Locator = examplePane.getByRole('tab', { name: 'Schema' });

    await expect(exampleTab).toHaveAttribute('aria-selected', 'true');
    await expect(schemaTab).toHaveAttribute('aria-selected', 'false');

    await schemaTab.click();

    await expect(schemaTab).toHaveAttribute('aria-selected', 'true');
    await expect(exampleTab).toHaveAttribute('aria-selected', 'false');

    const schemaPanel: Locator = examplePane.locator('[data-name="modelPanel"]');
    await expect(schemaPanel).toBeVisible();
    await expect(schemaPanel).not.toBeEmpty();
  });

  test('should list every documented endpoint under its tag', async ({ page }) => {
    const tagSections: Locator = page.locator('.opblock-tag-section');
    await tagSections.first().waitFor({ state: 'visible' });

    const tagCount: number = await tagSections.count();
    expect(tagCount).toBeGreaterThan(0);

    let taggedOperations: number = 0;
    for (let index: number = 0; index < tagCount; index += 1) {
      const operations: number = await tagSections.nth(index).locator('.opblock').count();
      expect(operations).toBeGreaterThan(0);
      taggedOperations += operations;
    }

    // Every rendered operation belongs to a tag section — nothing is orphaned.
    expect(taggedOperations).toBe(await elements.endpoints.count());
  });

  test('should expose the curl command and its copy control after execute', async ({ page }) => {
    const endpoint: Locator = page.locator(USER_ENDPOINTS.GET_COLLECTION);
    await endpoint.click();

    await endpoint.locator('button:has-text("Try it out")').click();
    await endpoint.locator('button:has-text("Execute")').click();

    const curlBlock: Locator = endpoint.locator('.curl-command');
    await expect(curlBlock).toBeVisible({ timeout: EXECUTE_TIMEOUT });
    await expect(curlBlock).toContainText('curl');

    const copyButton: Locator = endpoint.locator(locators.copyButton);
    await expect(copyButton).toBeVisible();
    await copyButton.click();
    await expect(copyButton).toBeVisible();
  });

  test('should render the live response after execute', async ({ page }) => {
    const endpoint: Locator = page.locator(USER_ENDPOINTS.GET_COLLECTION);
    await endpoint.click();

    await endpoint.locator('button:has-text("Try it out")').click();
    await endpoint.locator('button:has-text("Execute")').click();

    const liveResponses: Locator = endpoint.locator('.live-responses-table');
    await expect(liveResponses).toBeVisible({ timeout: EXECUTE_TIMEOUT });

    // Assert the shape, not the value: Mockoon generates responses from the
    // OpenAPI schema, so the status code is the contract and the body is not.
    await expect(endpoint.locator(locators.responseStatus).last()).toHaveText(/^\d{3}$/);
  });

  // Named for what it can actually verify: Mockoon generates responses from the
  // OpenAPI schema and serves the first declared status regardless of the body,
  // so the contract here is that a malformed body still produces a rendered
  // response rather than a hang or a blank pane — not that the API rejects it.
  test('should render a response for a malformed request body', async ({ page }) => {
    const endpoint: Locator = page.locator(USER_ENDPOINTS.CREATE);
    await endpoint.click();

    await endpoint.locator('button:has-text("Try it out")').click();

    const bodyEditor: Locator = endpoint.locator(locators.jsonEditor);
    await expect(bodyEditor).toBeVisible();
    await bodyEditor.fill('{"invalid": "data"}');
    await expect(bodyEditor).toHaveValue('{"invalid": "data"}');

    await endpoint.locator('button:has-text("Execute")').click();

    // The UI must still surface a response rather than hanging or blanking.
    const liveResponses: Locator = endpoint.locator('.live-responses-table');
    await expect(liveResponses).toBeVisible({ timeout: EXECUTE_TIMEOUT });

    await expect(endpoint.locator(locators.responseStatus).last()).toHaveText(/^\d{3}$/);
  });
});
