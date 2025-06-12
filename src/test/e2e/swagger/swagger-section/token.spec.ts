import { expect, type Locator, Page, test } from '@playwright/test';

import { getSystemEndpoints, GetSystemEndpoints } from '../utils';
import { TEST_OAUTH_DATA, BASE_API, errorResponse, ExpectedError } from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpoint,
  getAndCheckExecuteBtn,
  cancelOperation,
} from '../utils/helpers';

interface OAuthRequest {
  grant_type: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  code?: string;
  refresh_token?: string;
}

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

const TOKEN_API_URL: string = `${BASE_API}/oauth/token`;
const DEFAULT_REQUEST_BODY: OAuthRequest = {
  grant_type: 'authorization_code',
  client_id: 'default_client_id',
  client_secret: 'default_client_secret',
  redirect_uri: 'https://example.com/oauth/callback',
  code: 'default_code',
  refresh_token: 'default_refresh_token',
};

async function setupTokenEndpoint(page: Page): Promise<TokenEndpointElements> {
  const { elements } = await initSwaggerPage(page);
  const systemEndpoints: GetSystemEndpoints = getSystemEndpoints(page);
  const tokenEndpoint: Locator = systemEndpoints.token;
  await tokenEndpoint.click();
  await elements.tryItOutButton.click();
  const executeBtn: Locator = await getAndCheckExecuteBtn(tokenEndpoint);
  const requestBodySection: Locator = tokenEndpoint.locator('.opblock-section-request-body');
  await requestBodySection.waitFor({ state: 'visible' });
  const contentTypeSelect: Locator = requestBodySection.locator(
    'select[aria-label="Request content type"]'
  );
  const grantTypeInput: Locator = tokenEndpoint.locator('.body-param textarea.body-param__text');
  const curl: Locator = tokenEndpoint.locator('.curl-command');
  const copyButton: Locator = tokenEndpoint.locator('div.curl-command .copy-to-clipboard button');
  const requestUrl: Locator = tokenEndpoint.locator('.request-url .microlight');
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
    await expect(elements.requestUrl).toContainText('/oauth/token');
    await expect(elements.curlBody).toBeVisible();
    await expect(elements.curlBody).toContainText('"GRANT_TYPE": "new_authorization_code"');
    await expect(elements.curlBody).toContainText('"CLIENT_ID": "new_client_id_123"');
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
    // Change the request body
    await elements.grantTypeInput.fill(JSON.stringify({ grant_type: 'changed' }, null, 2));
    await expect(elements.grantTypeInput).not.toHaveValue(
      JSON.stringify(DEFAULT_REQUEST_BODY, null, 2)
    );
    // Click reset
    await elements.resetButton.click();
    // Should restore to default
    await expect(elements.grantTypeInput).toHaveValue(
      JSON.stringify(DEFAULT_REQUEST_BODY, null, 2)
    );

    await cancelOperation(page);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: TokenEndpointElements = await setupTokenEndpoint(page);
    await elements.grantTypeInput.fill(JSON.stringify(TEST_OAUTH_DATA, null, 2));
    await page.route(`${TOKEN_API_URL}**`, route => route.abort('failed'));
    await elements.executeBtn.click();
    const responseErrorSelector: string =
      '.responses-table.live-responses-table .response .response-col_description';
    const responseStatusSelector: string =
      '.responses-table.live-responses-table .response .response-col_status';
    const errorMessage: string | null = await elements.getEndpoint
      .locator(responseErrorSelector)
      .textContent();
    const hasExpectedError: ExpectedError = errorMessage?.match(
      new RegExp(Object.values(errorResponse).join('|'), 'i')
    );
    expect(hasExpectedError).toBeTruthy();
    await expect(elements.getEndpoint.locator(responseStatusSelector)).toContainText(
      'Undocumented'
    );
    await clearEndpoint(elements.getEndpoint);
  });
});
