import { expect, type Locator, Page, test } from '@playwright/test';

import {
  confirmationToken,
  BASE_API,
  BasicEndpointElements,
  mockoonHost,
} from '../utils/constants';
import {
  clearEndpointResponse,
  interceptWithErrorResponse,
  cancelOperation,
  initSwaggerPage,
  getAndCheckExecuteBtn,
  expectErrorOrFailureStatus,
  collapseEndpoint,
} from '../utils/helpers';

const CONFIRM_API_URL: string = `${BASE_API}/confirm`;

interface ConfirmEndpointElements extends BasicEndpointElements {
  parametersSection: Locator;
  tokenInput: Locator;
  curl: Locator;
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

  return {
    getEndpoint: confirmEndpoint,
    executeBtn,
    parametersSection,
    tokenInput,
    requestUrl,
    responseBody,
    curl,
  };
}
async function fillConfirmBody(elements: ConfirmEndpointElements, token: string): Promise<void> {
  await elements.tokenInput.fill(token);
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

    const status: Locator = elements.getEndpoint.locator('.response .response-col_status').first();
    await expect(status).toContainText(/20[04]/);

    await clearEndpointResponse(elements.getEndpoint);
  });

  test('empty token validation', async ({ page }) => {
    const elements: ConfirmEndpointElements = await setupConfirmEndpoint(page);

    await expect(elements.tokenInput).toBeVisible();
    await elements.tokenInput.clear();
    await elements.executeBtn.click();

    await expect(elements.tokenInput).toHaveClass(/invalid/);

    await cancelOperation(page);

    await collapseEndpoint(elements.getEndpoint);
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

    await clearEndpointResponse(elements.getEndpoint);
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

    await clearEndpointResponse(elements.getEndpoint);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: ConfirmEndpointElements = await setupConfirmEndpoint(page);

    await page.route(CONFIRM_API_URL, route => route.abort('failed'), { times: 1 });

    await fillConfirmBody(elements, confirmationToken);
    await elements.executeBtn.click();

    await expectErrorOrFailureStatus(elements.getEndpoint);

    await clearEndpointResponse(elements.getEndpoint);
  });
});
