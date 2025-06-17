import { expect, type Locator, Page, test } from '@playwright/test';

import { getSystemEndpoints, GetSystemEndpoints } from '../utils';
import { TEST_OAUTH_DATA } from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpoint,
  getAndCheckExecuteBtn,
  cancelOperation,
  getEndpointCopyButton,
  expectErrorOrFailureStatus,
} from '../utils/helpers';
import { locators } from '../utils/locators';

interface TokenEndpointElements {
  getEndpoint: Locator;
  executeBtn: Locator;
  requestBodySection: Locator;
  contentTypeSelect: Locator;
  grantTypeInput: Locator;
  curl: Locator;
  copyButton: Locator;
  requestUrl: Locator;
  curlBody: Locator;
  resetButton: Locator;
}

const TOKEN_API_URL: string = '**/api/oauth/token';

async function setupTokenEndpoint(page: Page): Promise<TokenEndpointElements> {
  const { elements } = await initSwaggerPage(page);
  const systemEndpoints: GetSystemEndpoints = getSystemEndpoints(page);
  const tokenEndpoint: Locator = systemEndpoints.token;
  await tokenEndpoint.click();
  await elements.tryItOutButton.click();
  const executeBtn: Locator = await getAndCheckExecuteBtn(tokenEndpoint);
  const requestBodySection: Locator = tokenEndpoint.locator(locators.requestBodySection);
  await requestBodySection.waitFor({ state: 'visible' });
  const contentTypeSelect: Locator = requestBodySection.locator(
    'select[aria-label="Request content type"]'
  );
  const grantTypeInput: Locator = tokenEndpoint.locator(locators.jsonEditor);
  const requestUrl: Locator = tokenEndpoint.locator(locators.requestUrl);
  const copyButton: Locator = await getEndpointCopyButton(tokenEndpoint);
  const curl: Locator = tokenEndpoint.locator(locators.curl);
  const curlBody: Locator = tokenEndpoint.locator('.curl-command pre.curl.microlight');
  const resetButton: Locator = tokenEndpoint.locator('button:has-text("Reset")');

  return {
    getEndpoint: tokenEndpoint,
    executeBtn,
    requestBodySection,
    contentTypeSelect,
    grantTypeInput,
    curl,
    copyButton,
    requestUrl,
    curlBody,
    resetButton,
  };
}

test.describe('OAuth token endpoint', () => {
  test('success scenario', async ({ page }) => {
    const elements: TokenEndpointElements = await setupTokenEndpoint(page);
    await expect(elements.contentTypeSelect).toBeVisible();
    await expect(elements.contentTypeSelect).toHaveValue('application/json');
    await expect(elements.grantTypeInput).toBeVisible();
    await elements.grantTypeInput.fill(JSON.stringify(TEST_OAUTH_DATA, null, 2));
    await elements.executeBtn.click();

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();

    await clearEndpoint(elements.getEndpoint);
  });

  test('empty request body validation', async ({ page }) => {
    const elements: TokenEndpointElements = await setupTokenEndpoint(page);
    await elements.grantTypeInput.fill('');
    await elements.executeBtn.click();
    await expect(elements.grantTypeInput).toHaveClass(/invalid/);
    await cancelOperation(page);
  });

  test('reset button restores default request body', async ({ page }) => {
    const elements: TokenEndpointElements = await setupTokenEndpoint(page);
    const initialValue: string = await elements.grantTypeInput.inputValue();

    await elements.grantTypeInput.fill(JSON.stringify({ grant_type: 'changed' }, null, 2));
    await elements.resetButton.click();

    await expect(elements.grantTypeInput).toHaveValue(initialValue);

    await cancelOperation(page);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: TokenEndpointElements = await setupTokenEndpoint(page);
    await elements.grantTypeInput.fill(JSON.stringify(TEST_OAUTH_DATA, null, 2));
    await page.route(`${TOKEN_API_URL}`, route => route.abort('failed'));
    await elements.executeBtn.click();

    await expectErrorOrFailureStatus(elements.getEndpoint);

    await clearEndpoint(elements.getEndpoint);
  });
});
