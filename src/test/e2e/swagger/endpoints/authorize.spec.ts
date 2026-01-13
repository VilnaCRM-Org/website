import { expect, type Locator, Page, test } from '@playwright/test';

import { getSystemEndpoints, GetSystemEndpoints } from '../utils';
import { testOAuthParams, PARAM_INPUTS } from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpointResponse,
  getAndCheckExecuteBtn,
  cancelOperation,
  expectErrorOrFailureStatus,
  enableTryItOut,
} from '../utils/helpers';
import { locators } from '../utils/locators';

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

const AUTHORIZE_API_URL: RegExp = /\/api\/oauth\/authorize(\?.*)?$/;

async function setupAuthorizeEndpoint(page: Page): Promise<AuthorizeEndpointElements> {
  await initSwaggerPage(page);
  const systemEndpoints: GetSystemEndpoints = getSystemEndpoints(page);
  const authorizeEndpoint: Locator = systemEndpoints.authorize;
  await enableTryItOut(authorizeEndpoint);
  const executeBtn: Locator = await getAndCheckExecuteBtn(authorizeEndpoint);
  const responseTypeInput: Locator = authorizeEndpoint.locator(PARAM_INPUTS.RESPONSE_TYPE);
  const clientIdInput: Locator = authorizeEndpoint.locator(PARAM_INPUTS.CLIENT_ID);
  const redirectUriInput: Locator = authorizeEndpoint.locator(PARAM_INPUTS.REDIRECT_URI);
  const scopeInput: Locator = authorizeEndpoint.locator(PARAM_INPUTS.SCOPE);
  const stateInput: Locator = authorizeEndpoint.locator(PARAM_INPUTS.STATE);
  const curl: Locator = authorizeEndpoint.locator(locators.curl);
  const parametersSection: Locator = authorizeEndpoint.locator(locators.parametersSection);
  const requestUrl: Locator = authorizeEndpoint.locator(locators.requestUrl);
  const responseBody: Locator = authorizeEndpoint.locator(locators.responseBody).first();
  const copyButton: Locator = authorizeEndpoint.locator(locators.copyButton);

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
async function fillAuthorizeForm(
  page: Page,
  params: typeof testOAuthParams = testOAuthParams
): Promise<AuthorizeEndpointElements> {
  const elements: AuthorizeEndpointElements = await setupAuthorizeEndpoint(page);

  await expect(elements.parametersSection).toBeVisible();

  await elements.responseTypeInput.fill(params.responseType);
  await elements.clientIdInput.fill(params.clientId);
  await elements.redirectUriInput.fill(params.redirectUri);
  await elements.scopeInput.fill(params.scope);
  await elements.stateInput.fill(params.state);

  return elements;
}
test.describe('OAuth authorize endpoint', () => {
  test('GET /oauth/authorize should be interactive with mocked success', async ({ page }) => {
    const elements: AuthorizeEndpointElements = await fillAuthorizeForm(page);

    await page.route('**/oauth/authorize**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'mock_auth_code_123',
          state: testOAuthParams.state,
          message: 'Mocked OAuth authorization success',
        }),
      });
    });

    await elements.executeBtn.click();

    const responseWrapper: Locator = elements.getEndpoint.locator('.responses-wrapper');
    await expect(responseWrapper).toBeVisible({ timeout: 10000 });
    await expect(responseWrapper).toContainText('mock_auth_code_123');
    await expect(responseWrapper).toContainText('Mocked OAuth authorization success');

    const curlSection: Locator = elements.getEndpoint.locator('.curl-command');
    const copyButton: Locator = elements.getEndpoint.locator(
      '.curl-command .copy-to-clipboard button'
    );
    await expect(curlSection).toBeVisible();
    await expect(copyButton).toBeVisible();

    await expect(elements.requestUrl).toContainText('/oauth/authorize');

    await clearEndpointResponse(elements.getEndpoint);
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
    await elements.scopeInput.fill(testOAuthParams.scope);
    await elements.stateInput.fill(testOAuthParams.state);

    await page.route(AUTHORIZE_API_URL, r => r.abort('failed'));
    const redirectRe: RegExp = new RegExp(
      `^${testOAuthParams.redirectUri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`
    );

    await page.route(redirectRe, r => r.abort('failed'));
    await Promise.all([page.waitForRequest(AUTHORIZE_API_URL), elements.executeBtn.click()]);

    await expectErrorOrFailureStatus(elements.getEndpoint);

    await clearEndpointResponse(elements.getEndpoint);
  });
});
