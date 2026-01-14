import { expect, type Locator, Page, test } from '@playwright/test';

import { getSystemEndpoints, GetSystemEndpoints } from '../utils';
import { TEST_OAUTH_DATA, TOKEN_ENDPOINT } from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpointResponse,
  getAndCheckExecuteBtn,
  cancelOperation,
  getEndpointCopyButton,
  expectErrorOrFailureStatus,
  collapseEndpoint,
} from '../utils/helpers';
import { locators } from '../utils/locators';

interface TokenEndpointElements {
  getEndpoint: Locator;
  executeBtn: Locator;
  requestBodySection: Locator;
  contentTypeSelect: Locator;
  requestBodyEditor: Locator;
  curl: Locator;
  copyButton: Locator;
  requestUrl: Locator;
  curlBody: Locator;
  resetButton: Locator;
}

const TOKEN_API_URL: string = '**/api/oauth/token';

async function setupTokenEndpoint(page: Page): Promise<TokenEndpointElements> {
  await initSwaggerPage(page);
  const systemEndpoints: GetSystemEndpoints = getSystemEndpoints(page);
  const tokenEndpoint: Locator = systemEndpoints.token;
  await tokenEndpoint.click();
  await tokenEndpoint.locator('button:has-text("Try it out")').click();
  const executeBtn: Locator = await getAndCheckExecuteBtn(tokenEndpoint);
  const requestBodySection: Locator = tokenEndpoint.locator(locators.requestBodySection);
  await requestBodySection.waitFor({ state: 'visible' });
  const contentTypeSelect: Locator = requestBodySection.locator(
    'select[aria-label="Request content type"]'
  );
  const requestBodyEditor: Locator = tokenEndpoint.locator(locators.jsonEditor);
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
    requestBodyEditor,
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
    await expect(elements.requestBodyEditor).toBeVisible();
    await elements.requestBodyEditor.fill(JSON.stringify(TEST_OAUTH_DATA, null, 2));
    await elements.executeBtn.click();

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await expect(elements.requestUrl).toBeVisible();
    await expect(elements.requestUrl).toContainText(TOKEN_ENDPOINT.PATH);
    await expect(elements.curlBody).toBeVisible();
    await expect(elements.curlBody).toContainText(TOKEN_ENDPOINT.CURL.METHOD);
    await expect(elements.curlBody).toContainText(TOKEN_ENDPOINT.CURL.URL);
    await expect(elements.curlBody).toContainText(TOKEN_ENDPOINT.CURL.ACCEPT_HEADER);
    await expect(elements.curlBody).toContainText(TOKEN_ENDPOINT.CURL.CONTENT_TYPE_HEADER);

    await clearEndpointResponse(elements.getEndpoint);
  });

  test('empty request body validation', async ({ page }) => {
    const elements: TokenEndpointElements = await setupTokenEndpoint(page);
    await elements.requestBodyEditor.fill('');
    await elements.executeBtn.click();
    await expect(elements.requestBodyEditor).toHaveClass(/invalid/);
    await cancelOperation(page);

    await collapseEndpoint(elements.getEndpoint);
  });

  test('reset button restores default request body', async ({ page }) => {
    const elements: TokenEndpointElements = await setupTokenEndpoint(page);
    const initialValue: string = await elements.requestBodyEditor.inputValue();

    await elements.requestBodyEditor.fill(JSON.stringify({ grant_type: 'changed' }, null, 2));

    await expect(elements.resetButton).toBeVisible();
    await expect(elements.resetButton).toBeEnabled();

    await elements.resetButton.click();

    await expect(elements.requestBodyEditor).toHaveValue(initialValue);

    await cancelOperation(page);

    await collapseEndpoint(elements.getEndpoint);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: TokenEndpointElements = await setupTokenEndpoint(page);
    await elements.requestBodyEditor.fill(JSON.stringify(TEST_OAUTH_DATA, null, 2));

    await page.route(TOKEN_API_URL, route => route.abort('failed'), { times: 1 });

    await elements.executeBtn.click();

    await expectErrorOrFailureStatus(elements.getEndpoint);

    await clearEndpointResponse(elements.getEndpoint);
  });
});
