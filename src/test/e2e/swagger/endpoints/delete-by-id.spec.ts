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
  expectOnlyDocumentedId,
  selectDocumentedId,
} from '../utils/helpers';
import { locators } from '../utils/locators';

interface DeleteUserEndpointElements extends BasicEndpointElements {
  parametersSection: Locator;
  idSelect: Locator;
  responseBody: Locator;
  curl: Locator;
  copyButton: Locator;
  requestUrl: Locator;
}

const DELETE_USER_API_URL: (id: string) => string = (id: string): string =>
  `${BASE_API.replace(/\/$/, '')}/${encodeURIComponent(id)}`;

async function setupDeleteUserEndpoint(page: Page): Promise<DeleteUserEndpointElements> {
  const { userEndpoints, elements } = await initSwaggerPage(page);
  const deleteEndpoint: Locator = userEndpoints.deleteById;

  await deleteEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(deleteEndpoint);
  const parametersSection: Locator = deleteEndpoint.locator(locators.parametersSection);
  const idSelect: Locator = deleteEndpoint.locator(locators.idSelect);
  const responseBody: Locator = deleteEndpoint.locator(locators.responseBody).first();
  const curl: Locator = deleteEndpoint.locator(locators.curl);
  const copyButton: Locator = deleteEndpoint.locator(locators.copyButton);
  const requestUrl: Locator = deleteEndpoint.locator(locators.requestUrl);

  return {
    getEndpoint: deleteEndpoint,
    executeBtn,
    parametersSection,
    idSelect,
    responseBody,
    curl,
    copyButton,
    requestUrl,
  };
}

test.describe('delete by ID', () => {
  test('successful user deletion', async ({ page }) => {
    const elements: DeleteUserEndpointElements = await setupDeleteUserEndpoint(page);
    const userId: string = await selectDocumentedId(elements.idSelect);
    await interceptWithEmptyResponse(page, DELETE_USER_API_URL(userId));

    await expect(elements.parametersSection).toBeVisible();
    await expect(elements.idSelect).toBeVisible();
    await elements.executeBtn.click();

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await expect(elements.requestUrl).toContainText(userId);

    const responseCode: Locator = elements.getEndpoint
      .locator('.response .response-col_status')
      .first();
    await expect(responseCode).toContainText('204');

    await clearEndpointResponse(elements.getEndpoint);
  });

  test('error response - user not found', async ({ page }) => {
    const elements: DeleteUserEndpointElements = await setupDeleteUserEndpoint(page);
    const userId: string = await selectDocumentedId(elements.idSelect);

    await interceptWithErrorResponse(
      page,
      DELETE_USER_API_URL(userId),
      {
        error: 'Not Found',
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      },
      404
    );
    await elements.executeBtn.click();

    const responseCode: Locator = elements.getEndpoint
      .locator('.response .response-col_status')
      .first();
    await expect(responseCode).toContainText('404');
    await expect(elements.responseBody).toContainText('User not found');

    await clearEndpointResponse(elements.getEndpoint);
  });

  test('only the documented user id can be sent', async ({ page }) => {
    const elements: DeleteUserEndpointElements = await setupDeleteUserEndpoint(page);

    await expectOnlyDocumentedId(elements.idSelect);

    await cancelOperation(page);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: DeleteUserEndpointElements = await setupDeleteUserEndpoint(page);
    const userId: string = await selectDocumentedId(elements.idSelect);

    await interceptWithNetworkFailure(page, DELETE_USER_API_URL(userId));
    await elements.executeBtn.click();

    await expectErrorOrFailureStatus(elements.getEndpoint);

    await clearEndpointResponse(elements.getEndpoint);
  });
});
