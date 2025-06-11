import { expect, type Locator, Page, test } from '@playwright/test';

import {
  confirmationToken,
  BASE_API,
  ExpectedError,
  BasicEndpointElements,
} from '../utils/constants';
import {
  clearEndpoint,
  interceptWithErrorResponse,
  cancelOperation,
  initSwaggerPage,
  getAndCheckExecuteBtn,
} from '../utils/helpers';

const mockoonHost: string = 'http://localhost:8080/';
const CONFIRM_API_URL: string = `${BASE_API}/confirm`;

interface ConfirmEndpointElements extends BasicEndpointElements {
  parametersSection: Locator;
  tokenInput: Locator;
  requestUrl: Locator;
  responseBody: Locator;
  curl: Locator;
  copyButton: Locator;
}

async function setupConfirmEndpoint(page: Page): Promise<ConfirmEndpointElements> {
  const { userEndpoints, elements } = await initSwaggerPage(page);
  const confirmEndpoint: Locator = userEndpoints.confirm;

  await confirmEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(confirmEndpoint);
  const parametersSection: Locator = confirmEndpoint.locator('.parameters-container');
  const tokenInput: Locator = confirmEndpoint.locator('.body-param textarea.body-param__text');
  const requestUrl: Locator = confirmEndpoint.locator('.request-url .microlight');
  const responseBody: Locator = confirmEndpoint
    .locator('.response-col_description .microlight')
    .first();
  const curl: Locator = confirmEndpoint.locator('.curl-command');
  const copyButton: Locator = confirmEndpoint.locator('div.curl-command .copy-to-clipboard button');

  return {
    getEndpoint: confirmEndpoint,
    executeBtn,
    parametersSection,
    tokenInput,
    requestUrl,
    responseBody,
    curl,
    copyButton,
  };
}
async function fillConfirmBody(elements: ConfirmEndpointElements, token: string): Promise<void> {
  const reqBody: string = JSON.stringify({ token }, null, 2);
  await elements.tokenInput.fill(reqBody);
}
test.describe('confirm endpoint tests', () => {
  test('successful confirmation with valid token', async ({ page }) => {
    const elements: ConfirmEndpointElements = await setupConfirmEndpoint(page);

    await expect(elements.parametersSection).toBeVisible();
    await expect(elements.tokenInput).toBeVisible();
    await fillConfirmBody(elements, confirmationToken);

    await elements.executeBtn.click();

    await expect(elements.curl).toBeVisible();
    await expect(elements.curl).toContainText(confirmationToken);
    await expect(elements.requestUrl).toBeVisible();
    await expect(elements.requestUrl).toContainText(mockoonHost);

    await expect(elements.curl).toContainText(confirmationToken);
    await clearEndpoint(elements.getEndpoint);
  });

  test('empty token validation', async ({ page }) => {
    const elements: ConfirmEndpointElements = await setupConfirmEndpoint(page);

    await expect(elements.tokenInput).toBeVisible();
    await elements.tokenInput.fill('');
    await elements.executeBtn.click();

    await expect(elements.tokenInput).toHaveClass(/invalid/);

    await cancelOperation(page);
  });

  test('error response - invalid token', async ({ page }) => {
    const elements: ConfirmEndpointElements = await setupConfirmEndpoint(page);

    await interceptWithErrorResponse(page, CONFIRM_API_URL, {
      error: 'Bad Request',
      message: 'Invalid confirmation token',
      code: 'INVALID_TOKEN',
    });

    await fillConfirmBody(elements, 'invalid_token');
    await elements.executeBtn.click();

    const responseCode: Locator = elements.getEndpoint
      .locator('.response .response-col_status')
      .first();
    await expect(responseCode).toContainText('400');

    await expect(elements.responseBody).toContainText('Invalid confirmation token');

    await clearEndpoint(elements.getEndpoint);
  });

  test('error response - expired token', async ({ page }) => {
    const elements: ConfirmEndpointElements = await setupConfirmEndpoint(page);

    await interceptWithErrorResponse(page, CONFIRM_API_URL, {
      error: 'Bad Request',
      message: 'Confirmation token has expired',
      code: 'TOKEN_EXPIRED',
    });
    await fillConfirmBody(elements, 'expired_token');
    await elements.executeBtn.click();

    await expect(elements.responseBody).toContainText('Confirmation token has expired');

    await clearEndpoint(elements.getEndpoint);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: ConfirmEndpointElements = await setupConfirmEndpoint(page);

    await page.route(CONFIRM_API_URL, route => route.abort('failed'));

    await fillConfirmBody(elements, confirmationToken);
    await elements.executeBtn.click();

    const responseErrorSelector: string = '.response-col_description .renderedMarkdown p';
    const responseStatusSelector: string = '.response .response-col_status';

    const errorMessage: string | null = await elements.getEndpoint
      .locator(responseErrorSelector)
      .first()
      .textContent();
    const statusCode: string | null = await elements.getEndpoint
      .locator(responseStatusSelector)
      .first()
      .textContent();

    const hasExpectedError: ExpectedError = errorMessage?.match(
      /Failed to fetch|Network Error|CORS|Connection failed/i
    );
    const hasFailureStatus: ExpectedError = statusCode?.match(/0|4\d{2}|5\d{2}/);

    expect(hasExpectedError || hasFailureStatus || null).toBeTruthy();

    await clearEndpoint(elements.getEndpoint);
  });
});
