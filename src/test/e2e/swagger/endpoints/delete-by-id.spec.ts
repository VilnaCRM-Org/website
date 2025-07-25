import { expect, type Locator, Page, test } from '@playwright/test';

import { testUserId, BASE_API, BasicEndpointElements } from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpointResponse,
  getAndCheckExecuteBtn,
  interceptWithErrorResponse,
  cancelOperation,
  expectErrorOrFailureStatus,
} from '../utils/helpers';
import { locators } from '../utils/locators';

interface DeleteUserEndpointElements extends BasicEndpointElements {
  parametersSection: Locator;
  idInput: Locator;
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
  const idInput: Locator = deleteEndpoint.locator(locators.idInput);
  const responseBody: Locator = deleteEndpoint.locator(locators.responseBody).first();
  const curl: Locator = deleteEndpoint.locator(locators.curl);
  const copyButton: Locator = deleteEndpoint.locator(locators.copyButton);
  const requestUrl: Locator = deleteEndpoint.locator(locators.requestUrl);

  return {
    getEndpoint: deleteEndpoint,
    executeBtn,
    parametersSection,
    idInput,
    responseBody,
    curl,
    copyButton,
    requestUrl,
  };
}

test.describe('delete by ID', () => {
  test('successful user deletion', async ({ page }) => {
    const elements: DeleteUserEndpointElements = await setupDeleteUserEndpoint(page);

    await expect(elements.parametersSection).toBeVisible();
    await expect(elements.idInput).toBeVisible();

    await elements.idInput.fill(testUserId);
    await elements.executeBtn.click();

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await expect(elements.requestUrl).toContainText(testUserId);

    const responseCode: Locator = elements.getEndpoint
      .locator('.response .response-col_status')
      .first();
    await expect(responseCode).toContainText('204');

    await clearEndpointResponse(elements.getEndpoint);
  });

  test('empty ID validation', async ({ page }) => {
    const elements: DeleteUserEndpointElements = await setupDeleteUserEndpoint(page);

    await elements.idInput.clear();
    await elements.executeBtn.click();

    await expect(elements.idInput).toHaveClass(/invalid/);
    const expectedErrorMsg: RegExp = /For 'id':\s*Required field is not provided\./;
    await expect(elements.getEndpoint.locator('.validation-errors.errors-wrapper li')).toHaveText(
      expectedErrorMsg
    );

    await cancelOperation(page);
  });

  test('error response - user not found', async ({ page }) => {
    const elements: DeleteUserEndpointElements = await setupDeleteUserEndpoint(page);
    const nonExistentId: string = '2b10b7a3-67f0-40ea-a367-44263321592z';

    await interceptWithErrorResponse(
      page,
      DELETE_USER_API_URL(nonExistentId),
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

    await clearEndpointResponse(elements.getEndpoint);
  });

  test('error response - invalid id format', async ({ page }) => {
    const elements: DeleteUserEndpointElements = await setupDeleteUserEndpoint(page);
    const invalidId: string = 'invalid-uuid-format';

    await interceptWithErrorResponse(
      page,
      DELETE_USER_API_URL(invalidId),
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

    await clearEndpointResponse(elements.getEndpoint);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: DeleteUserEndpointElements = await setupDeleteUserEndpoint(page);

    await page.route(DELETE_USER_API_URL(testUserId), route => route.abort('failed'));

    await elements.idInput.fill(testUserId);
    await elements.executeBtn.click();

    await expectErrorOrFailureStatus(elements.getEndpoint);

    await clearEndpointResponse(elements.getEndpoint);
  });
});
