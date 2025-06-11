import { expect, type Locator, Page, test } from '@playwright/test';

import {
  ApiUser,
  BasicEndpointElements,
  errorResponse,
  ExpectedError,
  TEST_USERS,
  User,
} from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpoint,
  getAndCheckExecuteBtn,
  interceptWithError,
} from '../utils/helpers';

interface CreateUserEndpointElements extends BasicEndpointElements {
  requestBody: Locator;
  responseBody: Locator;
  curl: Locator;
  copyButton: Locator;
  downloadButton?: Locator;
}

async function setupCreateUserEndpoint(page: Page): Promise<CreateUserEndpointElements> {
  const { userEndpoints, elements } = await initSwaggerPage(page);
  const getEndpoint: Locator = userEndpoints.create;

  await getEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(getEndpoint);
  const requestBody: Locator = getEndpoint.locator('.body-param__text');
  const requestUrl: Locator = getEndpoint.locator('.request-url .microlight');
  const responseBody: Locator = getEndpoint
    .locator('.response-col_description .microlight')
    .first();

  const curl: Locator = getEndpoint.locator('.curl-command');
  const copyButton: Locator = getEndpoint.locator('div.curl-command .copy-to-clipboard button');
  const downloadButton: Locator = getEndpoint.locator('button.download-contents');

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
async function cancelOperation(page: Page): Promise<void> {
  const cancelBtn: Locator = page.locator('button.btn.try-out__btn.cancel');
  await cancelBtn.click();
}
async function fillRequestBody(
  elements: CreateUserEndpointElements,
  userData: Partial<User> | null
): Promise<void> {
  let requestBodyContent: string;

  if (userData === null) {
    requestBodyContent = '';
  } else if (Object.keys(userData).length === 0) {
    requestBodyContent = '{}';
  } else {
    const cleanedData: { [k: string]: string } = Object.fromEntries(
      Object.entries(userData).filter(([, value]) => value !== undefined)
    );
    requestBodyContent = JSON.stringify(cleanedData, null, 2);
  }

  await elements.requestBody.fill(requestBodyContent);
}

async function verifySuccessResponse(elements: CreateUserEndpointElements): Promise<void> {
  const responseText: string = (await elements.responseBody.textContent()) || '';
  const response: ApiUser = JSON.parse(responseText);

  expect(response).toMatchObject({
    confirmed: expect.any(Boolean),
    email: expect.any(String),
    initials: expect.any(String),
    id: expect.any(String),
  });
}

test.describe('Create user endpoint tests', () => {
  test('successful user creation', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await fillRequestBody(elements, TEST_USERS.VALID);
    await elements.executeBtn.click();

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await verifySuccessResponse(elements);

    await clearEndpoint(elements.getEndpoint);
  });

  test('empty request body validation', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await fillRequestBody(elements, null);
    await elements.executeBtn.click();

    await expect(elements.requestBody).toHaveClass(/invalid/);

    await cancelOperation(page);
  });
  test('null in request body', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await fillRequestBody(elements, null);
    await elements.executeBtn.click();

    await expect(elements.requestBody).toHaveClass(/invalid/);

    await cancelOperation(page);
  });
  test('empty object in request body', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await fillRequestBody(elements, {});
    await elements.executeBtn.click();

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

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await verifySuccessResponse(elements);

    await clearEndpoint(elements.getEndpoint);
  });
  test('error response - invalid email', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await interceptWithError(page, 400, {
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

    await interceptWithError(page, 400, {
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
      new RegExp(Object.values(errorResponse).join('|'))
    );
    const hasFailureStatus: ExpectedError = statusCode?.match(/0|4\d{2}|5\d{2}/);

    expect(hasExpectedError || hasFailureStatus || null).toBeTruthy();

    await clearEndpoint(elements.getEndpoint);
  });
  test('response download functionality', async ({ page }) => {
    const elements: CreateUserEndpointElements = await setupCreateUserEndpoint(page);

    await fillRequestBody(elements, TEST_USERS.VALID);
    await elements.executeBtn.click();

    await elements.responseBody.waitFor({ state: 'visible' });

    await page.waitForTimeout(1000);

    const downloadButton: Locator = elements.getEndpoint.locator(
      '.responses-wrapper .highlight-code button.download-contents'
    );

    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeEnabled();

    await Promise.all([page.waitForEvent('download'), downloadButton.click()]);

    await clearEndpoint(elements.getEndpoint);
  });
});
