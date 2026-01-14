import { Download, expect, type Locator, Page, test } from '@playwright/test';

import { testUserId, BASE_API, BasicEndpointElements, ApiUser } from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpointResponse,
  getAndCheckExecuteBtn,
  interceptWithErrorResponse,
  cancelOperation,
  expectErrorOrFailureStatus,
  buildSafeUrl,
  parseJsonSafe,
} from '../utils/helpers';
import { locators } from '../utils/locators';

const GET_USER_API_URL: (id: string) => string = (id: string): string => buildSafeUrl(BASE_API, id);

type UserIds = {
  VALID: string;
  NON_EXISTENT: string;
  INVALID_FORMAT: string;
};
const TEST_USER_IDS: UserIds = {
  VALID: testUserId,
  NON_EXISTENT: '2b10b7a3-67f0-40ea-a367-44263321592z',
  INVALID_FORMAT: 'invalid-uuid-format',
} as const;

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
  const parametersSection: Locator = getUserEndpoint.locator(locators.parametersSection);
  const validationError: Locator = getUserEndpoint.locator(locators.validationErrors);
  const idInput: Locator = getUserEndpoint.locator(locators.idInput);
  const requestUrl: Locator = getUserEndpoint.locator(locators.requestUrl);
  const responseBody: Locator = getUserEndpoint.locator(locators.responseBody).first();
  const curl: Locator = getUserEndpoint.locator(locators.curl);
  const copyButton: Locator = getUserEndpoint.locator(locators.copyButton);
  const downloadButton: Locator = getUserEndpoint.locator(locators.downloadButton);

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
    await elements.idInput.fill(TEST_USER_IDS.VALID);

    await elements.executeBtn.click();

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await expect(elements.requestUrl).toContainText(TEST_USER_IDS.VALID);

    const responseText: string | null = await elements.responseBody.textContent();

    if (!responseText) {
      throw new Error('Response body is empty');
    }

    const response: ApiUser = parseJsonSafe<ApiUser>(responseText);

    expect(response).toEqual(
      expect.objectContaining({
        confirmed: expect.any(Boolean),
        email: expect.any(String),
        initials: expect.any(String),
        id: expect.any(String),
      })
    );
    await expect(elements.downloadButton).toBeVisible();
    const downloadPromise: Promise<Download> = page.waitForEvent('download');
    await elements.downloadButton.click();
    await expect(await downloadPromise).toBeDefined();

    await clearEndpointResponse(elements.getEndpoint);
  });

  test('empty id validation', async ({ page }) => {
    const elements: GetUserByIdElements = await setupGetUserByIdEndpoint(page);

    await expect(elements.idInput).toBeVisible();
    await elements.idInput.clear();
    await elements.executeBtn.click();

    await expect(elements.idInput).toHaveClass(/invalid/);
    await expect(elements.validationError).toContainText('Required field is not provided');

    await cancelOperation(page);
  });

  test('error response - user not found', async ({ page }) => {
    const elements: GetUserByIdElements = await setupGetUserByIdEndpoint(page);
    const nonExistentId: string = TEST_USER_IDS.NON_EXISTENT;

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

    await clearEndpointResponse(elements.getEndpoint);
  });

  test('error response - invalid id format', async ({ page }) => {
    const elements: GetUserByIdElements = await setupGetUserByIdEndpoint(page);
    const invalidId: string = TEST_USER_IDS.INVALID_FORMAT;

    await interceptWithErrorResponse(page, GET_USER_API_URL(invalidId), {
      error: 'Bad Request',
      message: 'Invalid user ID format',
      code: 'INVALID_ID_FORMAT',
    });

    await elements.idInput.fill(invalidId);
    await elements.executeBtn.click();

    await expect(elements.responseBody).toContainText('Invalid user ID format');

    await clearEndpointResponse(elements.getEndpoint);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: GetUserByIdElements = await setupGetUserByIdEndpoint(page);

    await page.route(GET_USER_API_URL(TEST_USER_IDS.VALID), route => route.abort('failed'));

    await elements.idInput.fill(TEST_USER_IDS.VALID);
    await elements.executeBtn.click();

    await expectErrorOrFailureStatus(elements.getEndpoint);

    await clearEndpointResponse(elements.getEndpoint);
  });
});
