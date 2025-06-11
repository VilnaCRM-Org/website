import { expect, type Locator, Page, test } from '@playwright/test';

import {
  ApiUser,
  BASE_API,
  BasicEndpointElements,
  errorResponse,
  ExpectedError,
  BatchUserData,
  validBatchData,
  TEST_PASSWORDS,
} from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpoint,
  getAndCheckExecuteBtn,
  cancelOperation,
  interceptWithErrorResponse,
} from '../utils/helpers';

interface BatchUserEndpointElements extends BasicEndpointElements {
  requestBodySection: Locator;
  contentTypeSelect: Locator;
  jsonEditor: Locator;
  responseBody: Locator;
  curl: Locator;
  copyButton: Locator;
  requestUrl: Locator;
  downloadButton?: Locator;
}

async function setupBatchEndpoint(page: Page): Promise<BatchUserEndpointElements> {
  const { userEndpoints, elements } = await initSwaggerPage(page);
  const createBatchEndpoint: Locator = userEndpoints.createBatch;

  await createBatchEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(createBatchEndpoint);
  const requestBodySection: Locator = createBatchEndpoint.locator('.opblock-section-request-body');
  const contentTypeSelect: Locator = requestBodySection.locator(
    'select[aria-label="Request content type"]'
  );
  const jsonEditor: Locator = requestBodySection.locator('.body-param__text');
  const responseBody: Locator = createBatchEndpoint
    .locator('.response-col_description .microlight')
    .first();
  const curl: Locator = createBatchEndpoint.locator('.curl-command');
  const copyButton: Locator = createBatchEndpoint.locator(
    'div.curl-command .copy-to-clipboard button'
  );
  const requestUrl: Locator = createBatchEndpoint.locator('.request-url .microlight');
  const downloadButton: Locator = createBatchEndpoint.locator('button.download-contents');

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
    downloadButton,
  };
}

async function fillBatchRequestBody(
  elements: BatchUserEndpointElements,
  userData: BatchUserData | null
): Promise<void> {
  let requestBodyContent: string;

  if (userData === null) {
    requestBodyContent = '';
  } else if (Object.keys(userData).length === 0) {
    requestBodyContent = '{}';
  } else {
    requestBodyContent = JSON.stringify(userData, null, 2);
  }

  await elements.jsonEditor.fill(requestBodyContent);
}

async function verifySuccessResponse(elements: BatchUserEndpointElements): Promise<void> {
  const responseText: string = (await elements.responseBody.textContent()) || '';
  const response: ApiUser[] = JSON.parse(responseText);

  response.forEach(user => {
    expect(user).toMatchObject({
      confirmed: expect.any(Boolean),
      email: expect.any(String),
      initials: expect.any(String),
      id: expect.any(String),
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
    await clearEndpoint(elements.getEndpoint);
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
    await clearEndpoint(elements.getEndpoint);
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
    await clearEndpoint(elements.getEndpoint);
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
    await clearEndpoint(elements.getEndpoint);
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
    await clearEndpoint(elements.getEndpoint);
  });

  test('network failure handling', async ({ page }) => {
    const elements: BatchUserEndpointElements = await setupBatchEndpoint(page);

    await page.route('**/api/users/batch', route => route.abort('failed'));

    await fillBatchRequestBody(elements, validBatchData);
    await elements.executeBtn.click();
    await verifyCommonElements(elements);

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
});
