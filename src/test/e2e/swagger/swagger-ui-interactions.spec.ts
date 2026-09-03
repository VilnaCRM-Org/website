import { test, expect, type Locator } from '@playwright/test';

import { INTERACTION_STATES } from '../../a11y/interaction-states';
import { scanInteractionState } from '../../a11y/scan-interaction-state';

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

/**
 * Budget for the tag/operation tally to settle. Bounded so a genuinely orphaned
 * operation reports within the test's own timeout instead of consuming it.
 */
const TAG_TALLY_TIMEOUT: number = 10_000;

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
    // Swagger is the heaviest page in the suite and this test also runs an axe
    // scan over it, so give it the slow-test budget rather than risk a timeout
    // flake on a loaded CI runner.
    test.slow();

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

    // A dialog layered over the documentation is the hardest state for a11y to
    // get right and the one no initial-load scan sees (#369): the assertions
    // above check the two labels this spec knows about, the scan checks every
    // rule against the whole composed page.
    await scanInteractionState(page, INTERACTION_STATES.swaggerAuthorizeDialog);

    await authModal.locator('button:has-text("Close")').click();
    await expect(authModal).not.toBeVisible();
  });

  test('should handle response examples', async ({ page }) => {
    // Carries the expanded-operation axe scan; see the note above.
    test.slow();

    // Pin the endpoint rather than taking whichever renders first: document
    // order is a property of the upstream spec, not of this behaviour.
    const endpoint: Locator = page.locator(USER_ENDPOINTS.GET_COLLECTION);
    await endpoint.click();

    const documentedResponses: Locator = endpoint.locator(
      '.responses-inner .response-col_description__inner'
    );

    await expect(documentedResponses.first()).toBeVisible();
    expect(await documentedResponses.count()).toBeGreaterThan(0);

    // An expanded operation is the interaction state the Swagger page exists
    // for, and all of it — the response table, the tab pair, the try-it-out
    // controls — is mounted only by this click (#369).
    await scanInteractionState(page, INTERACTION_STATES.swaggerOperationExpanded);

    const exampleValue: Locator = endpoint.locator('.responses-inner .model-example').first();
    await expect(exampleValue).toBeVisible();

    // `.microlight` is the rendered-code container the rest of the swagger
    // suite uses. Parse what it rendered instead of asserting on a field name,
    // which would couple this gate to the pinned contract — and instead of
    // checking the opening character, which a truncated example would pass.
    const renderedExample: Locator = exampleValue.locator('.microlight').first();
    await expect(renderedExample).toBeVisible();

    const exampleText: string = (await renderedExample.innerText()).trim();
    expect(() => JSON.parse(exampleText) as unknown).not.toThrow();
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

    // Every rendered operation belongs to a tag section — nothing is orphaned.
    //
    // The whole comparison is re-evaluated by `toPass()` rather than assembled
    // from counts read at three different moments. Swagger mounts its operation
    // blocks progressively, so a section appearing between the per-section reads
    // and the final total would fail a strict equality as a flake with an "X is
    // not Y" diff, not as a real orphan. Retrying the entire tally means both
    // sides are compared against one settled render, and a genuine orphan still
    // fails — it just fails after the retries instead of on the first race.
    await expect(async () => {
      const sectionCount: number = await tagSections.count();
      expect(sectionCount).toBeGreaterThan(0);

      let taggedOperations: number = 0;
      for (let index: number = 0; index < sectionCount; index += 1) {
        const operations: number = await tagSections.nth(index).locator('.opblock').count();
        expect(operations).toBeGreaterThan(0);
        taggedOperations += operations;
      }

      expect(taggedOperations).toBe(await elements.endpoints.count());
    }).toPass({ timeout: TAG_TALLY_TIMEOUT });
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
