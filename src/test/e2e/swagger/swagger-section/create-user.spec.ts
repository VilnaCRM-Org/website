import { expect, type Locator, Page, test } from '@playwright/test';

import { ApiUser, BASE_API, BasicEndpointElements, TEST_USERS, User } from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpoint,
  getAndCheckExecuteBtn,
  interceptWithErrorResponse,
  cancelOperation,
  expectErrorOrFailureStatus,
} from '../utils/helpers';
import { locators } from '../utils/locators';

interface CreateUserEndpointElements extends BasicEndpointElements {
  requestBody: Locator;
  responseBody: Locator;
  curl: Locator;
  copyButton: Locator;
  downloadButton: Locator;
}

async function setupCreateUserEndpoint(page: Page): Promise<CreateUserEndpointElements> {
  const { userEndpoints, elements } = await initSwaggerPage(page);
  const getEndpoint: Locator = userEndpoints.create;

  await getEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(getEndpoint);
  const requestBody: Locator = getEndpoint.locator(locators.jsonEditor);
  const requestUrl: Locator = getEndpoint.locator(locators.requestUrl);
  const responseBody: Locator = getEndpoint.locator(locators.responseBody).first();
  const curl: Locator = getEndpoint.locator(locators.curl);
  const copyButton: Locator = getEndpoint.locator(locators.copyButton);
  const downloadButton: Locator = getEndpoint.locator(locators.downloadButton);

  return {
    getEndpoint,
    executeBtn,
    requestBody,
    requestUrl,
    responseBody,
    curl,
    copyButton,
    downloadButton,
  };
}

async function fillRequestBody(
  elements: CreateUserEndpointElements,
  userData: Partial<User> | null
): Promise<void> {
  const cleaned: Record<string, unknown> | null = userData
    ? Object.fromEntries(Object.entries(userData).filter(([, v]) => v !== undefined))
    : null;
  const requestBodyContent: string = cleaned === null ? '' : JSON.stringify(cleaned, null, 2);

  await elements.requestBody.fill(requestBodyContent);
}

async function verifySuccessResponse(elements: CreateUserEndpointElements): Promise<void> {
  await elements.responseBody.waitFor({ state: 'visible' });

  const responseText: string = (await elements.responseBody.textContent()) || '';
  let response: ApiUser;

  try {
    response = JSON.parse(responseText);
  } catch (err) {
    throw new Error(`Unexpected non-JSON response body: "${responseText}"`);
  }

  expect(response).toMatchObject({
    confirmed: expect.any(Boolean),
    email: expect.any(String),
    initials: expect.any(String),
    id: expect.any(String),
  });
}

test.describe('Create user endpoint tests', () => {
  const API_URL: string = `${BASE_API}**`;

  test('successful user creation', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await fillRequestBody(elements, TEST_USERS.VALID);
    await elements.executeBtn.click();

    await elements.responseBody.waitFor({ state: 'visible' });

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await verifySuccessResponse(elements);

    await clearEndpoint(elements.getEndpoint);
  });

  test('empty request body validation', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await elements.requestBody.fill('');
    await elements.executeBtn.click();

    await expect(elements.requestBody).toHaveClass(/invalid/);

    await cancelOperation(page);
  });
  test('null in request body', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await fillRequestBody(elements, null);
    await elements.executeBtn.click();
    await elements.responseBody.waitFor({ state: 'visible' });

    await expect(elements.requestBody).toHaveClass(/invalid/);

    await cancelOperation(page);
  });
  test('empty object in request body', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await fillRequestBody(elements, {});
    await elements.executeBtn.click();
    await elements.responseBody.waitFor({ state: 'visible' });

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await verifySuccessResponse(elements);

    await clearEndpoint(elements.getEndpoint);
  });
  test('object with empty values', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await fillRequestBody(elements, {
      email: '',
      password: '',
      initials: '',
    });
    await elements.executeBtn.click();
    await elements.responseBody.waitFor({ state: 'visible' });

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await verifySuccessResponse(elements);

    await clearEndpoint(elements.getEndpoint);
  });
  test('partially filled request body', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await fillRequestBody(elements, {
      email: 'test@example.com',
    });
    await elements.executeBtn.click();
    await elements.responseBody.waitFor({ state: 'visible' });

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await verifySuccessResponse(elements);

    await clearEndpoint(elements.getEndpoint);
  });
  test('error response - invalid email', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await interceptWithErrorResponse(page, API_URL, {
      error: 'Bad Request',
      message: 'Invalid email format',
      code: 'INVALID_EMAIL',
    });

    await fillRequestBody(elements, TEST_USERS.INVALID_EMAIL);
    await elements.executeBtn.click();

    const responseCode: Locator = elements.getEndpoint.locator(
      'table.responses-table.live-responses-table tbody .response-col_status'
    );
    await expect(responseCode).toContainText('400');
    await expect(elements.responseBody).toContainText('Invalid email format');

    await clearEndpoint(elements.getEndpoint);
  });
  test('error response - weak password', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await interceptWithErrorResponse(page, API_URL, {
      error: 'Bad Request',
      message: 'Password too weak',
      code: 'WEAK_PASSWORD',
    });

    await fillRequestBody(elements, TEST_USERS.WEAK_PASSWORD);
    await elements.executeBtn.click();

    await expect(elements.responseBody).toContainText('Password too weak');

    await clearEndpoint(elements.getEndpoint);
  });
  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await page.route('**/api/users', route => route.abort('failed'));

    await fillRequestBody(elements, TEST_USERS.VALID);
    await elements.executeBtn.click();

    await expectErrorOrFailureStatus(elements.getEndpoint);

    await clearEndpoint(elements.getEndpoint);
  });
  test('response download functionality', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await fillRequestBody(elements, TEST_USERS.VALID);
    await elements.executeBtn.click();

    await elements.responseBody.waitFor({ state: 'visible' });

    const downloadButton: Locator = elements.getEndpoint.locator(
      '.response-col_description .highlight-code button.download-contents'
    );

    await downloadButton.waitFor({ state: 'visible' });

    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeEnabled();
    await downloadButton.click();

    await clearEndpoint(elements.getEndpoint);
  });
});
