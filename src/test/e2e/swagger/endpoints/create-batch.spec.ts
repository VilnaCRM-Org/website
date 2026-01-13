import { expect, type Locator, Page, test } from '@playwright/test';

import {
  BASE_API,
  BasicEndpointElements,
  BatchUserData,
  validBatchData,
  TEST_PASSWORDS,
  User,
} from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpointResponse,
  getAndCheckExecuteBtn,
  cancelOperation,
  interceptWithErrorResponse,
  expectErrorOrFailureStatus,
  parseJsonSafe,
  enableTryItOut,
} from '../utils/helpers';
import { locators } from '../utils/locators';

interface BatchUserEndpointElements extends BasicEndpointElements {
  requestBodySection: Locator;
  contentTypeSelect: Locator;
  jsonEditor: Locator;
  curl: Locator;
  copyButton: Locator;
}

async function setupBatchEndpoint(page: Page): Promise<BatchUserEndpointElements> {
  const { userEndpoints } = await initSwaggerPage(page);
  const createBatchEndpoint: Locator = userEndpoints.createBatch;

  await enableTryItOut(createBatchEndpoint);

  const executeBtn: Locator = await getAndCheckExecuteBtn(createBatchEndpoint);
  const requestBodySection: Locator = createBatchEndpoint.locator(locators.requestBodySection);
  const contentTypeSelect: Locator = requestBodySection.locator(locators.contentTypeSelect);
  const jsonEditor: Locator = requestBodySection.locator(locators.jsonEditor);
  const responseBody: Locator = createBatchEndpoint.locator(locators.responseBody).first();
  const curl: Locator = createBatchEndpoint.locator(locators.curl);
  const copyButton: Locator = createBatchEndpoint.locator(locators.copyButton);
  const requestUrl: Locator = createBatchEndpoint.locator(locators.requestUrl);

  return {
    getEndpoint: createBatchEndpoint,
    executeBtn,
    requestBodySection,
    contentTypeSelect,
    jsonEditor,
    responseBody,
    curl,
    copyButton,
    requestUrl,
  };
}

async function fillBatchRequestBody(
  elements: BatchUserEndpointElements,
  userData: BatchUserData | null
): Promise<void> {
  const requestBodyContent: string = userData === null ? '' : JSON.stringify(userData, null, 2);

  await elements.jsonEditor.fill(requestBodyContent);
}

async function verifySuccessResponse(elements: BatchUserEndpointElements): Promise<void> {
  const responseText: string = (await elements.curl.textContent()) || '';

  const jsonMatch: RegExpMatchArray | null = responseText.match(
    /-d\s+['"]([\s\S]*?)['"]\s*(?:\\\s*)?$/
  );
  if (!jsonMatch) {
    throw new Error(`Failed to extract JSON from response: ${responseText}`);
  }

  const response: { users: User[] } = parseJsonSafe<{ users: User[] }>(jsonMatch[1]);

  expect(response.users).toHaveLength(2);

  response.users.forEach(user => {
    expect(user).toMatchObject({
      email: expect.any(String),
      initials: expect.any(String),
    });
  });
}

async function verifyCommonElements(elements: BatchUserEndpointElements): Promise<void> {
  await expect(elements.requestBodySection).toBeVisible();
  await expect(elements.contentTypeSelect).toBeVisible();
  await expect(elements.contentTypeSelect).toHaveValue('application/json');
  await expect(elements.jsonEditor).toBeVisible();
  await expect(elements.jsonEditor).toBeEditable();
  await expect(elements.curl).toBeVisible();
  await expect(elements.copyButton).toBeVisible();
  await expect(elements.requestUrl).toBeVisible();
  await expect(elements.requestUrl).toContainText('/users/batch');
}

test.describe('Create batch users endpoint tests', () => {
  const BATCH_API_URL: string = `${BASE_API}/batch`;

  test('successful batch user creation', async ({ page }) => {
    const elements: BatchUserEndpointElements = await setupBatchEndpoint(page);

    await fillBatchRequestBody(elements, validBatchData);
    await elements.executeBtn.click();
    await verifyCommonElements(elements);

    await verifySuccessResponse(elements);
    await clearEndpointResponse(elements.getEndpoint);
  });

  test('empty request body validation', async ({ page }) => {
    const elements: BatchUserEndpointElements = await setupBatchEndpoint(page);

    await fillBatchRequestBody(elements, null);
    await elements.executeBtn.click();

    await expect(elements.jsonEditor).toHaveClass(/invalid/);

    await cancelOperation(page);
  });

  test('empty users array', async ({ page }) => {
    const elements: BatchUserEndpointElements = await setupBatchEndpoint(page);
    const emptyBatchData: BatchUserData = { users: [] };

    await interceptWithErrorResponse(page, BATCH_API_URL, {
      error: 'Bad Request',
      message: 'Users array cannot be empty',
      code: 'INVALID_INPUT',
    });

    await fillBatchRequestBody(elements, emptyBatchData);
    await elements.executeBtn.click();
    await verifyCommonElements(elements);

    await expect(elements.responseBody).toContainText('Users array cannot be empty');
    await clearEndpointResponse(elements.getEndpoint);
  });

  test('invalid email formats', async ({ page }) => {
    const elements: BatchUserEndpointElements = await setupBatchEndpoint(page);
    const invalidEmailData: BatchUserData = {
      users: [
        {
          email: 'invalid-email',
          initials: 'IE',
          password: TEST_PASSWORDS.STRONG,
        },
      ],
    };

    await interceptWithErrorResponse(page, BATCH_API_URL, {
      error: 'Bad Request',
      message: 'Invalid email format',
      code: 'INVALID_EMAIL',
    });

    await fillBatchRequestBody(elements, invalidEmailData);
    await elements.executeBtn.click();
    await verifyCommonElements(elements);

    await expect(elements.responseBody).toContainText('Invalid email format');
    await clearEndpointResponse(elements.getEndpoint);
  });

  test('weak passwords', async ({ page }) => {
    const elements: BatchUserEndpointElements = await setupBatchEndpoint(page);
    const weakPasswordData: BatchUserData = {
      users: [
        {
          email: 'user1@example.com',
          initials: 'U1',
          password: TEST_PASSWORDS.WEAK,
        },
      ],
    };

    await interceptWithErrorResponse(page, BATCH_API_URL, {
      error: 'Bad Request',
      message: 'Password too weak',
      code: 'WEAK_PASSWORD',
    });

    await fillBatchRequestBody(elements, weakPasswordData);
    await elements.executeBtn.click();
    await verifyCommonElements(elements);

    await expect(elements.responseBody).toContainText('Password too weak');
    await clearEndpointResponse(elements.getEndpoint);
  });

  test('duplicate emails', async ({ page }) => {
    const elements: BatchUserEndpointElements = await setupBatchEndpoint(page);

    await interceptWithErrorResponse(page, BATCH_API_URL, {
      error: 'Bad Request',
      message: 'Duplicate email addresses found',
      code: 'DUPLICATE_EMAIL',
    });

    const duplicateEmailData: BatchUserData = {
      users: [
        {
          email: 'same@example.com',
          initials: 'U1',
          password: TEST_PASSWORDS.STRONG,
        },
        {
          email: 'same@example.com',
          initials: 'U2',
          password: TEST_PASSWORDS.STRONG,
        },
      ],
    };

    await fillBatchRequestBody(elements, duplicateEmailData);
    await elements.executeBtn.click();
    await verifyCommonElements(elements);

    await expect(elements.responseBody).toContainText('Duplicate email addresses found');
    await clearEndpointResponse(elements.getEndpoint);
  });

  test('network failure handling', async ({ page }) => {
    const elements: BatchUserEndpointElements = await setupBatchEndpoint(page);

    await page.route(`${BASE_API}/batch`, route => route.abort('failed'), { times: 1 });

    await fillBatchRequestBody(elements, validBatchData);
    await elements.executeBtn.click();

    await verifyCommonElements(elements);

    await expectErrorOrFailureStatus(elements.getEndpoint);
    await clearEndpointResponse(elements.getEndpoint);
  });
});
