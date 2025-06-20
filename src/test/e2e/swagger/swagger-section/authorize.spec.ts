import { expect, type Locator, Page, test } from '@playwright/test';

import { getSystemEndpoints, GetSystemEndpoints } from '../utils';
import { mockoonHost, testOAuthParams, PARAM_INPUTS } from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpointResponse,
  getAndCheckExecuteBtn,
  cancelOperation,
  mockAuthorizeSuccess,
  buildSafeUrl,
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

const AUTHORIZE_API_URL: string = '**/oauth/authorize';

async function setupAuthorizeEndpoint(page: Page): Promise<AuthorizeEndpointElements> {
  const { elements } = await initSwaggerPage(page);
  const systemEndpoints: GetSystemEndpoints = getSystemEndpoints(page);
  const authorizeEndpoint: Locator = systemEndpoints.authorize;
  await authorizeEndpoint.click();
  await elements.tryItOutButton.click();
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
    await elements.scopeInput.fill(testOAuthParams.scope);
    await elements.stateInput.fill(testOAuthParams.state);

    await mockAuthorizeSuccess(
      page,
      buildSafeUrl(mockoonHost, 'oauth/authorize'),
      testOAuthParams.redirectUri,
      testOAuthParams.state
    );

    await elements.executeBtn.click();

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
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

    await page.route(AUTHORIZE_API_URL, route => route.abort('failed'));

    await elements.executeBtn.click();
    const errorElement: Locator = elements.getEndpoint
      .locator('.response-col_description .renderedMarkdown p')
      .first();
    const statusElement: Locator = elements.getEndpoint
      .locator('.response .response-col_status')
      .first();

    const [errorText, statusText] = await Promise.all([
      errorElement.textContent(),
      statusElement.textContent(),
    ]);

    expect(errorText).toContain('Redirect to the provided redirect URI');
    expect(statusText).toBe('302');

    await clearEndpointResponse(elements.getEndpoint);
  });
});
