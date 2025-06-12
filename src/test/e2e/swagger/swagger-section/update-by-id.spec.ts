import { expect, type Locator, Page, test } from '@playwright/test';

import {
  testUserId,
  BASE_API,
  BasicEndpointElements,
  errorResponse,
  ExpectedError,
  UpdatedUser,
} from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpoint,
  getAndCheckExecuteBtn,
  interceptWithErrorResponse,
  cancelOperation,
} from '../utils/helpers';

interface UpdateUserEndpointElements extends BasicEndpointElements {
  parametersSection: Locator;
  idInput: Locator;
  requestBodySection: Locator;
  jsonEditor: Locator;
  responseBody: Locator;
  curl: Locator;
  copyButton: Locator;
  downloadButton: Locator;
  requestUrl: Locator;
}

const UPDATE_USER_API_URL: (id: string) => string = (id: string): string => `${BASE_API}/${id}`;

async function setupUpdateUserEndpoint(page: Page): Promise<UpdateUserEndpointElements> {
  const { userEndpoints, elements } = await initSwaggerPage(page);
  const updateEndpoint: Locator = userEndpoints.updateById;

  await updateEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(updateEndpoint);
  const parametersSection: Locator = updateEndpoint.locator('.parameters-container');
  const idInput: Locator = updateEndpoint.locator('input[placeholder="id"]');
  const requestBodySection: Locator = updateEndpoint.locator('.opblock-section-request-body');
  const jsonEditor: Locator = requestBodySection.locator('.body-param__text');
  const responseBody: Locator = updateEndpoint
    .locator('.response-col_description .microlight')
    .first();
  const curl: Locator = updateEndpoint.locator('.curl.microlight');
  const copyButton: Locator = updateEndpoint.locator('div.curl-command .copy-to-clipboard button');
  const downloadButton: Locator = updateEndpoint.locator('button.download-contents');
  const requestUrl: Locator = updateEndpoint.locator('.request-url .microlight');

  return {
    getEndpoint: updateEndpoint,
    executeBtn,
    parametersSection,
    idInput,
    requestBodySection,
    jsonEditor,
    responseBody,
    curl,
    copyButton,
    downloadButton,
    requestUrl,
  };
}

test.describe('updateById', () => {
  test('default values', async ({ page }) => {
    const elements: UpdateUserEndpointElements = await setupUpdateUserEndpoint(page);

    await expect(elements.parametersSection).toBeVisible();
    await expect(elements.idInput).toBeVisible();
    await expect(elements.requestBodySection).toBeVisible();
    await expect(elements.jsonEditor).toBeVisible();

    const defaultRequestBody: UpdatedUser = {
      email: 'user@example.com',
      initials: 'WR',
      oldPassword: 'passWORD1',
      newPassword: 'PASSword2',
    };

    await elements.idInput.fill(testUserId);
    await elements.jsonEditor.fill(JSON.stringify(defaultRequestBody, null, 2));
    await elements.executeBtn.click();

    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await expect(elements.requestUrl).toContainText(testUserId);
    await expect(elements.downloadButton).toBeVisible();

    const responseText: string | null = await elements.responseBody.textContent();
    const response: string = JSON.parse(responseText || '{}');
    expect(response).toEqual(
      expect.objectContaining({
        email: expect.any(String),
        initials: expect.any(String),
        id: expect.any(String),
      })
    );

    await clearEndpoint(elements.getEndpoint);
  });

  test('custom values', async ({ page }) => {
    const elements: UpdateUserEndpointElements = await setupUpdateUserEndpoint(page);

    const customRequestBody: UpdatedUser = {
      email: 'updated@example.com',
      initials: 'UP',
      oldPassword: 'oldPass123!',
      newPassword: 'newPass456!',
    };

    await elements.idInput.fill(testUserId);
    await elements.jsonEditor.fill(JSON.stringify(customRequestBody, null, 2));
    await elements.executeBtn.click();

    await expect(elements.curl).toBeVisible();
    await expect(elements.requestUrl).toContainText(testUserId);

    const responseText: string | null = await elements.curl.textContent();

    expect(responseText).toContain('"email": "updated@example.com"');
    expect(responseText).toContain('"initials": "UP"');
    expect(responseText).toContain('"oldPassword": "oldPass123!"');
    expect(responseText).toContain('"newPassword": "newPass456!"');

    await clearEndpoint(elements.getEndpoint);
  });

  test('empty id validation message', async ({ page }) => {
    const elements: UpdateUserEndpointElements = await setupUpdateUserEndpoint(page);

    await elements.idInput.fill('');
    await elements.executeBtn.click();

    await expect(elements.idInput).toHaveClass(/invalid/);

    const expectedErrorMsg: string = " For 'id': Required field is not provided. ";
    await expect(
      elements.getEndpoint.locator('.validation-errors.errors-wrapper li')
    ).toContainText(expectedErrorMsg);

    await cancelOperation(page);
  });

  test('empty request body', async ({ page }) => {
    const elements: UpdateUserEndpointElements = await setupUpdateUserEndpoint(page);

    await elements.idInput.fill(testUserId);
    await elements.jsonEditor.fill('');
    await elements.executeBtn.click();

    await expect(elements.jsonEditor).toHaveClass(/invalid/);

    await cancelOperation(page);
  });

  test('download', async ({ page }) => {
    const elements: UpdateUserEndpointElements = await setupUpdateUserEndpoint(page);

    await elements.idInput.fill(testUserId);
    await elements.jsonEditor.fill(
      JSON.stringify(
        {
          email: 'download@example.com',
          initials: 'DL',
        },
        null,
        2
      )
    );
    await elements.executeBtn.click();

    await expect(elements.downloadButton).toBeVisible();
    await expect(elements.downloadButton).toBeEnabled();

    await clearEndpoint(elements.getEndpoint);
  });

  test('error response - invalid password', async ({ page }) => {
    const elements: UpdateUserEndpointElements = await setupUpdateUserEndpoint(page);

    await interceptWithErrorResponse(
      page,
      UPDATE_USER_API_URL(testUserId),
      {
        error: 'Bad Request',
        message: 'Invalid old password',
        code: 'INVALID_PASSWORD',
      },
      400
    );

    await elements.idInput.fill(testUserId);
    await elements.jsonEditor.fill(
      JSON.stringify(
        {
          oldPassword: 'wrongPass',
          newPassword: 'newPass123!',
        },
        null,
        2
      )
    );
    await elements.executeBtn.click();

    await expect(elements.responseBody).toContainText('Invalid old password');
    const responseCode: Locator = elements.getEndpoint
      .locator('.response .response-col_status')
      .first();
    await expect(responseCode).toContainText('400');

    await clearEndpoint(elements.getEndpoint);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: UpdateUserEndpointElements = await setupUpdateUserEndpoint(page);

    await page.route(UPDATE_USER_API_URL(testUserId), route => route.abort('failed'));

    await elements.idInput.fill(testUserId);
    await elements.jsonEditor.fill(
      JSON.stringify(
        {
          email: 'network@example.com',
          initials: 'NF',
        },
        null,
        2
      )
    );
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
