import { Download, expect, type Locator, Page, test } from '@playwright/test';

import { BASE_API, BasicEndpointElements, ApiUser, MOCK_API_USER } from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpointResponse,
  getAndCheckExecuteBtn,
  interceptWithErrorResponse,
  interceptWithJsonResponse,
  interceptWithNetworkFailure,
  cancelOperation,
  expectErrorOrFailureStatus,
  buildSafeUrl,
  parseJsonSafe,
  expectOnlyDocumentedId,
  selectDocumentedId,
} from '../utils/helpers';
import { locators } from '../utils/locators';

const GET_USER_API_URL: (id: string) => string = (id: string): string => buildSafeUrl(BASE_API, id);

interface GetUserByIdElements extends BasicEndpointElements {
  parametersSection: Locator;
  idSelect: Locator;
  requestUrl: Locator;
  responseBody: Locator;
  curl: Locator;
  copyButton: Locator;
  downloadButton: Locator;
}

async function setupGetUserByIdEndpoint(page: Page): Promise<GetUserByIdElements> {
  const { userEndpoints, elements } = await initSwaggerPage(page);
  const getUserEndpoint: Locator = userEndpoints.getById;

  await getUserEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(getUserEndpoint);
  const parametersSection: Locator = getUserEndpoint.locator(locators.parametersSection);
  const idSelect: Locator = getUserEndpoint.locator(locators.idSelect);
  const requestUrl: Locator = getUserEndpoint.locator(locators.requestUrl);
  const responseBody: Locator = getUserEndpoint.locator(locators.responseBody).first();
  const curl: Locator = getUserEndpoint.locator(locators.curl);
  const copyButton: Locator = getUserEndpoint.locator(locators.copyButton);
  const downloadButton: Locator = getUserEndpoint.locator(locators.downloadButton);

  return {
    getEndpoint: getUserEndpoint,
    executeBtn,
    parametersSection,
    idSelect,
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
    const userId: string = await selectDocumentedId(elements.idSelect);
    await interceptWithJsonResponse(page, GET_USER_API_URL(userId), MOCK_API_USER);

    await expect(elements.parametersSection).toBeVisible();
    await expect(elements.idSelect).toBeVisible();

    await elements.executeBtn.click();

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await expect(elements.requestUrl).toContainText(userId);

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

  test('only the documented user id can be sent', async ({ page }) => {
    const elements: GetUserByIdElements = await setupGetUserByIdEndpoint(page);

    await expectOnlyDocumentedId(elements.idSelect);

    await cancelOperation(page);
  });

  test('error response - user not found', async ({ page }) => {
    const elements: GetUserByIdElements = await setupGetUserByIdEndpoint(page);
    const userId: string = await selectDocumentedId(elements.idSelect);

    await interceptWithErrorResponse(
      page,
      GET_USER_API_URL(userId),
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

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: GetUserByIdElements = await setupGetUserByIdEndpoint(page);
    const userId: string = await selectDocumentedId(elements.idSelect);

    await interceptWithNetworkFailure(page, GET_USER_API_URL(userId));
    await elements.executeBtn.click();

    await expectErrorOrFailureStatus(elements.getEndpoint);

    await clearEndpointResponse(elements.getEndpoint);
  });
});
