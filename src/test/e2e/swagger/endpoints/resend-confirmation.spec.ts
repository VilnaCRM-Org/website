import { expect, type Locator, Page, test } from '@playwright/test';

import { BASE_API, BasicEndpointElements } from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpointResponse,
  getAndCheckExecuteBtn,
  interceptWithErrorResponse,
  interceptWithEmptyResponse,
  interceptWithNetworkFailure,
  cancelOperation,
  expectErrorOrFailureStatus,
  collapseEndpoint,
  expectOnlyDocumentedId,
  selectDocumentedId,
} from '../utils/helpers';
import { locators } from '../utils/locators';

interface ResendConfirmationEndpointElements extends BasicEndpointElements {
  parametersSection: Locator;
  idSelect: Locator;
  curl: Locator;
  copyButton: Locator;
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
  const idSelect: Locator = resendEndpoint.locator(locators.idSelect);
  const requestUrl: Locator = resendEndpoint.locator(locators.requestUrl);
  const responseBody: Locator = resendEndpoint.locator(locators.responseBody).first();
  const curl: Locator = resendEndpoint.locator(locators.curl);
  const copyButton: Locator = resendEndpoint.locator(locators.copyButton);

  return {
    getEndpoint: resendEndpoint,
    executeBtn,
    parametersSection,
    idSelect,
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
    const userId: string = await selectDocumentedId(elements.idSelect);
    await interceptWithEmptyResponse(page, RESEND_CONFIRM_API_URL(userId));
    await expect(elements.parametersSection).toBeVisible();
    await expect(elements.idSelect).toBeVisible();
    await elements.executeBtn.click();
    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await expect(elements.requestUrl).toContainText(userId);
    await expect(elements.requestUrl).toContainText('resend-confirmation-email');
    await clearEndpointResponse(elements.getEndpoint);
  });

  test('error response - user not found', async ({ page }) => {
    const elements: ResendConfirmationEndpointElements =
      await setupResendConfirmationEndpoint(page);
    const userId: string = await selectDocumentedId(elements.idSelect);
    await interceptWithErrorResponse(
      page,
      RESEND_CONFIRM_API_URL(userId),
      {
        error: 'Not Found',
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      },
      404
    );
    await elements.executeBtn.click();

    await elements.responseBody.waitFor({ state: 'visible' });

    const responseCode: Locator = elements.getEndpoint
      .locator('.response .response-col_status')
      .first();
    await expect(responseCode).toContainText('404');
    await expect(elements.responseBody).toContainText('User not found');
    await clearEndpointResponse(elements.getEndpoint);
  });

  test('only the documented user id can be sent', async ({ page }) => {
    const elements: ResendConfirmationEndpointElements =
      await setupResendConfirmationEndpoint(page);

    await expectOnlyDocumentedId(elements.idSelect);

    await cancelOperation(page);

    await collapseEndpoint(elements.getEndpoint);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: ResendConfirmationEndpointElements =
      await setupResendConfirmationEndpoint(page);
    const userId: string = await selectDocumentedId(elements.idSelect);

    await interceptWithNetworkFailure(page, RESEND_CONFIRM_API_URL(userId), { times: 1 });
    await elements.executeBtn.click();

    await expectErrorOrFailureStatus(elements.getEndpoint);

    await clearEndpointResponse(elements.getEndpoint);
  });
});
