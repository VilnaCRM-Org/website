import { expect, type Locator, Page, test } from '@playwright/test';

import {
  BASE_API,
  BasicEndpointElements,
  testUserId,
  ApiUser,
  errorResponse,
  ExpectedError,
} from '../utils/constants';
import {
  clearEndpoint,
  interceptWithErrorResponse,
  cancelOperation,
  initSwaggerPage,
  getAndCheckExecuteBtn,
} from '../utils/helpers';

const GET_USER_API_URL: (id: string) => string = (id: string): string => `${BASE_API}/${id}`;

interface GetUserByIdElements extends BasicEndpointElements {
  parametersSection: Locator;
  idInput: Locator;
  requestUrl: Locator;
  responseBody: Locator;
  curl: Locator;
  copyButton: Locator;
  downloadButton: Locator;
  validationError: Locator;
}

async function setupGetUserByIdEndpoint(page: Page): Promise<GetUserByIdElements> {
  const { userEndpoints, elements } = await initSwaggerPage(page);
  const getUserEndpoint: Locator = userEndpoints.getById;

  await getUserEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(getUserEndpoint);
  const parametersSection: Locator = getUserEndpoint.locator('.parameters-container');
  const validationError: Locator = getUserEndpoint.locator('.validation-errors.errors-wrapper');
  const idInput: Locator = getUserEndpoint.locator('input[placeholder="id"]');
  const requestUrl: Locator = getUserEndpoint.locator('.request-url .microlight');
  const responseBody: Locator = getUserEndpoint
    .locator('.response-col_description .microlight')
    .first();
  const curl: Locator = getUserEndpoint.locator('.curl-command');
  const copyButton: Locator = getUserEndpoint.locator('div.curl-command .copy-to-clipboard button');
  const downloadButton: Locator = getUserEndpoint.locator('button.download-contents');

  return {
    getEndpoint: getUserEndpoint,
    executeBtn,
    parametersSection,
    validationError,
    idInput,
    requestUrl,
    responseBody,
    curl,
    copyButton,
    downloadButton,
  };
}

test.describe('get user by ID', () => {
  test('successful user retrieval', async ({ page }) => {
    const elements: GetUserByIdElements = await setupGetUserByIdEndpoint(page);

    await expect(elements.parametersSection).toBeVisible();
    await expect(elements.idInput).toBeVisible();
    await elements.idInput.fill(testUserId);

    await elements.executeBtn.click();

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await expect(elements.requestUrl).toContainText(testUserId);

    const responseText: string | null = await elements.responseBody.textContent();
    const response: ApiUser = JSON.parse(responseText || '{}');
    expect(response).toEqual(
      expect.objectContaining({
        confirmed: expect.any(Boolean),
        email: expect.any(String),
        initials: expect.any(String),
        id: expect.any(String),
      })
    );
    await expect(elements.downloadButton).toBeVisible();

    await clearEndpoint(elements.getEndpoint);
  });

  test('empty id validation', async ({ page }) => {
    const elements: GetUserByIdElements = await setupGetUserByIdEndpoint(page);

    await expect(elements.idInput).toBeVisible();
    await elements.idInput.fill('');
    await elements.executeBtn.click();

    await expect(elements.idInput).toHaveClass(/invalid/);
    await expect(elements.validationError).toContainText('Required field is not provided');

    await cancelOperation(page);
  });

  test('error response - user not found', async ({ page }) => {
    const elements: GetUserByIdElements = await setupGetUserByIdEndpoint(page);
    const nonExistentId: string = '2b10b7a3-67f0-40ea-a367-44263321592z';

    await interceptWithErrorResponse(
      page,
      GET_USER_API_URL(nonExistentId),
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
    const elements: GetUserByIdElements = await setupGetUserByIdEndpoint(page);
    const invalidId: string = 'invalid-uuid-format';

    await interceptWithErrorResponse(page, GET_USER_API_URL(invalidId), {
      error: 'Bad Request',
      message: 'Invalid user ID format',
      code: 'INVALID_ID_FORMAT',
    });

    await elements.idInput.fill(invalidId);
    await elements.executeBtn.click();

    await expect(elements.responseBody).toContainText('Invalid user ID format');

    await clearEndpoint(elements.getEndpoint);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: GetUserByIdElements = await setupGetUserByIdEndpoint(page);

    await page.route(GET_USER_API_URL(testUserId), route => route.abort('failed'));

    await elements.idInput.fill(testUserId);
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
