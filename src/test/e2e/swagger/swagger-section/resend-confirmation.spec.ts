import { expect, type Locator, Page, test } from '@playwright/test';

import { testUserId, BASE_API, BasicEndpointElements } from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpoint,
  getAndCheckExecuteBtn,
  interceptWithErrorResponse,
  cancelOperation,
  expectErrorOrFailureStatus,
} from '../utils/helpers';
import { locators } from '../utils/locators';

interface ResendConfirmationEndpointElements extends BasicEndpointElements {
  parametersSection: Locator;
  idInput: Locator;
  curl: Locator;
  copyButton: Locator;
  requestUrl: Locator;
  responseBody: Locator;
}

const RESEND_CONFIRM_API_URL: (id: string) => string = (id: string): string =>
  `${BASE_API}/${id}/resend-confirmation-email`;

async function setupResendConfirmationEndpoint(
  page: Page
): Promise<ResendConfirmationEndpointElements> {
  const { userEndpoints, elements } = await initSwaggerPage(page);
  const resendEndpoint: Locator = userEndpoints.resendConfirmation;

  await resendEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(resendEndpoint);
  const parametersSection: Locator = resendEndpoint.locator(locators.parametersSection);
  const idInput: Locator = resendEndpoint.locator(locators.idInput);
  const requestUrl: Locator = resendEndpoint.locator(locators.requestUrl);
  const responseBody: Locator = resendEndpoint.locator(locators.responseBody).first();
  const curl: Locator = resendEndpoint.locator(locators.curl);
  const copyButton: Locator = resendEndpoint.locator(locators.copyButton);

  return {
    getEndpoint: resendEndpoint,
    executeBtn,
    parametersSection,
    idInput,
    curl,
    copyButton,
    requestUrl,
    responseBody,
  };
}

test.describe('resend confirmation email', () => {
  test('successfully resends confirmation email', async ({ page }) => {
    const elements: ResendConfirmationEndpointElements =
      await setupResendConfirmationEndpoint(page);
    await expect(elements.parametersSection).toBeVisible();
    await expect(elements.idInput).toBeVisible();
    await elements.idInput.fill(testUserId);
    await elements.executeBtn.click();
    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await expect(elements.requestUrl).toContainText(testUserId);
    await expect(elements.requestUrl).toContainText('resend-confirmation-email');
    await clearEndpoint(elements.getEndpoint);
  });

  test('empty ID validation', async ({ page }) => {
    const elements: ResendConfirmationEndpointElements =
      await setupResendConfirmationEndpoint(page);
    await elements.idInput.fill('');
    await elements.executeBtn.click();
    await expect(elements.idInput).toHaveClass(/invalid/);
    const expectedErrorMsg: RegExp = /For 'id':\s*Required field is not provided\./;
    await expect(elements.getEndpoint.locator('.validation-errors.errors-wrapper li')).toHaveText(
      expectedErrorMsg
    );

    await cancelOperation(page);
  });

  test('error response - user not found', async ({ page }) => {
    const elements: ResendConfirmationEndpointElements =
      await setupResendConfirmationEndpoint(page);
    const nonExistentId: string = '2b10b7a3-67f0-40ea-a367-44263321592z';
    await interceptWithErrorResponse(
      page,
      RESEND_CONFIRM_API_URL(nonExistentId),
      {
        error: 'Not Found',
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      },
      404
    );
    await elements.idInput.fill(nonExistentId);
    await elements.executeBtn.click();
    const responseCode: Locator = elements.getEndpoint
      .locator('.response .response-col_status')
      .first();
    await expect(responseCode).toContainText('404');
    await expect(elements.responseBody).toContainText('User not found');
    await clearEndpoint(elements.getEndpoint);
  });

  test('error response - invalid id format', async ({ page }) => {
    const elements: ResendConfirmationEndpointElements =
      await setupResendConfirmationEndpoint(page);
    const invalidId: string = 'invalid-uuid-format';
    await interceptWithErrorResponse(
      page,
      RESEND_CONFIRM_API_URL(invalidId),
      {
        error: 'Bad Request',
        message: 'Invalid user ID format',
        code: 'INVALID_ID_FORMAT',
      },
      400
    );
    await elements.idInput.fill(invalidId);
    await elements.executeBtn.click();
    await expect(elements.responseBody).toContainText('Invalid user ID format');
    const responseCode: Locator = elements.getEndpoint
      .locator('.response .response-col_status')
      .first();
    await expect(responseCode).toContainText('400');
    await clearEndpoint(elements.getEndpoint);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: ResendConfirmationEndpointElements =
      await setupResendConfirmationEndpoint(page);
    await page.route(RESEND_CONFIRM_API_URL(testUserId), route => route.abort('failed'));
    await elements.idInput.fill(testUserId);
    await elements.executeBtn.click();

    await expectErrorOrFailureStatus(elements.getEndpoint);

    await clearEndpoint(elements.getEndpoint);
  });
});
