import { expect, type Locator, Page, test } from '@playwright/test';

import { getSystemEndpoints, GetSystemEndpoints } from '../utils';
import { testOAuthParams, BASE_API, errorResponse, ExpectedError } from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpoint,
  getAndCheckExecuteBtn,
  cancelOperation,
} from '../utils/helpers';

interface AuthorizeEndpointElements {
  getEndpoint: Locator;
  executeBtn: Locator;
  parametersSection: Locator;
  responseTypeInput: Locator;
  clientIdInput: Locator;
  redirectUriInput: Locator;
  scopeInput: Locator;
  stateInput: Locator;
  curl: Locator;
  copyButton: Locator;
  requestUrl: Locator;
  responseBody: Locator;
}

const AUTHORIZE_API_URL: string = `${BASE_API}/oauth/authorize`;

async function setupAuthorizeEndpoint(page: Page): Promise<AuthorizeEndpointElements> {
  const { elements } = await initSwaggerPage(page);
  const systemEndpoints: GetSystemEndpoints = getSystemEndpoints(page);
  const authorizeEndpoint: Locator = systemEndpoints.authorize;
  await authorizeEndpoint.click();
  await elements.tryItOutButton.click();
  const executeBtn: Locator = await getAndCheckExecuteBtn(authorizeEndpoint);
  const parametersSection: Locator = authorizeEndpoint.locator('.parameters-container');
  const responseTypeInput: Locator = authorizeEndpoint.locator(
    'input[placeholder="response_type"]'
  );
  const clientIdInput: Locator = authorizeEndpoint.locator('input[placeholder="client_id"]');
  const redirectUriInput: Locator = authorizeEndpoint.locator('input[placeholder="redirect_uri"]');
  const scopeInput: Locator = authorizeEndpoint.locator('input[placeholder="scope"]');
  const stateInput: Locator = authorizeEndpoint.locator('input[placeholder="state"]');
  const curl: Locator = authorizeEndpoint.locator('.curl-command');
  const copyButton: Locator = authorizeEndpoint.locator(
    'div.curl-command .copy-to-clipboard button'
  );
  const requestUrl: Locator = authorizeEndpoint.locator('.request-url .microlight');
  const responseBody: Locator = authorizeEndpoint
    .locator('.response-col_description .microlight')
    .first();
  return {
    getEndpoint: authorizeEndpoint,
    executeBtn,
    parametersSection,
    responseTypeInput,
    clientIdInput,
    redirectUriInput,
    scopeInput,
    stateInput,
    curl,
    copyButton,
    requestUrl,
    responseBody,
  };
}

test.describe('OAuth authorize endpoint', () => {
  test('success scenario', async ({ page }) => {
    const elements: AuthorizeEndpointElements = await setupAuthorizeEndpoint(page);
    await expect(elements.parametersSection).toBeVisible();
    await expect(elements.responseTypeInput).toBeVisible();
    await expect(elements.clientIdInput).toBeVisible();
    await expect(elements.redirectUriInput).toBeVisible();
    await elements.responseTypeInput.fill(testOAuthParams.responseType);
    await elements.clientIdInput.fill(testOAuthParams.clientId);
    await elements.redirectUriInput.fill(testOAuthParams.redirectUri);
    await elements.scopeInput.fill('profile email');
    await elements.stateInput.fill('teststate');
    await elements.executeBtn.click();
    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await expect(elements.requestUrl).toContainText('/oauth/authorize');
    await clearEndpoint(elements.getEndpoint);
  });

  test('empty response_type validation', async ({ page }) => {
    const elements: AuthorizeEndpointElements = await setupAuthorizeEndpoint(page);
    await elements.responseTypeInput.fill('');
    await elements.clientIdInput.fill(testOAuthParams.clientId);
    await elements.redirectUriInput.fill(testOAuthParams.redirectUri);
    await elements.executeBtn.click();
    await expect(elements.responseTypeInput).toHaveClass(/invalid/);
    await expect(
      elements.getEndpoint.locator('.validation-errors.errors-wrapper li')
    ).toContainText("For 'response_type': Required field is not provided.");
    await cancelOperation(page);
  });

  test('empty client_id validation', async ({ page }) => {
    const elements: AuthorizeEndpointElements = await setupAuthorizeEndpoint(page);
    await elements.responseTypeInput.fill(testOAuthParams.responseType);
    await elements.clientIdInput.fill('');
    await elements.redirectUriInput.fill(testOAuthParams.redirectUri);
    await elements.executeBtn.click();
    await expect(elements.clientIdInput).toHaveClass(/invalid/);
    await expect(
      elements.getEndpoint.locator('.validation-errors.errors-wrapper li')
    ).toContainText("For 'client_id': Required field is not provided.");
    await cancelOperation(page);
  });

  test('empty redirect_uri validation', async ({ page }) => {
    const elements: AuthorizeEndpointElements = await setupAuthorizeEndpoint(page);
    await elements.responseTypeInput.fill(testOAuthParams.responseType);
    await elements.clientIdInput.fill(testOAuthParams.clientId);
    await elements.redirectUriInput.fill('');
    await elements.executeBtn.click();
    await expect(elements.redirectUriInput).toHaveClass(/invalid/);
    await expect(
      elements.getEndpoint.locator('.validation-errors.errors-wrapper li')
    ).toContainText("For 'redirect_uri': Required field is not provided.");
    await cancelOperation(page);
  });

  test('all required fields empty', async ({ page }) => {
    const elements: AuthorizeEndpointElements = await setupAuthorizeEndpoint(page);
    await elements.responseTypeInput.fill('');
    await elements.clientIdInput.fill('');
    await elements.redirectUriInput.fill('');
    await elements.executeBtn.click();
    await expect(elements.responseTypeInput).toHaveClass(/invalid/);
    await expect(elements.clientIdInput).toHaveClass(/invalid/);
    await expect(elements.redirectUriInput).toHaveClass(/invalid/);
    await expect(elements.getEndpoint.locator('.validation-errors.errors-wrapper')).toContainText(
      "For 'response_type': Required field is not provided."
    );
    await expect(elements.getEndpoint.locator('.validation-errors.errors-wrapper')).toContainText(
      "For 'client_id': Required field is not provided."
    );
    await expect(elements.getEndpoint.locator('.validation-errors.errors-wrapper')).toContainText(
      "For 'redirect_uri': Required field is not provided."
    );
    await cancelOperation(page);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: AuthorizeEndpointElements = await setupAuthorizeEndpoint(page);
    await elements.responseTypeInput.fill(testOAuthParams.responseType);
    await elements.clientIdInput.fill(testOAuthParams.clientId);
    await elements.redirectUriInput.fill(testOAuthParams.redirectUri);
    await elements.scopeInput.fill('profile email');
    await elements.stateInput.fill('teststate');
    await page.route(`${AUTHORIZE_API_URL}**`, route => route.abort('failed'));
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
