import { expect, type Locator, Page, test, type Download } from '@playwright/test';

import { testUserId, BASE_API, BasicEndpointElements, UpdatedUser } from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpoint,
  getAndCheckExecuteBtn,
  interceptWithErrorResponse,
  cancelOperation,
  expectErrorOrFailureStatus,
} from '../utils/helpers';
import { locators } from '../utils/locators';

interface PatchUserEndpointElements extends BasicEndpointElements {
  parametersSection: Locator;
  idInput: Locator;
  requestBodySection: Locator;
  jsonEditor: Locator;
  curl: Locator;
  copyButton: Locator;
  downloadButton: Locator;
}

const PATCH_USER_API_URL: (id: string) => string = (id: string): string => `${BASE_API}/${id}**`;

async function setupPatchUserEndpoint(page: Page): Promise<PatchUserEndpointElements> {
  const { userEndpoints, elements } = await initSwaggerPage(page);
  const patchEndpoint: Locator = userEndpoints.patchById;

  await patchEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(patchEndpoint);
  const parametersSection: Locator = patchEndpoint.locator(locators.parametersSection);
  const idInput: Locator = patchEndpoint.locator(locators.idInput);
  const requestBodySection: Locator = patchEndpoint.locator(locators.requestBodySection);
  const jsonEditor: Locator = requestBodySection.locator(locators.jsonEditor);
  const responseBody: Locator = patchEndpoint.locator(locators.responseBody).first();
  const curl: Locator = patchEndpoint.locator(locators.curl);
  const copyButton: Locator = patchEndpoint.locator(locators.copyButton);
  const downloadButton: Locator = patchEndpoint.locator(locators.downloadButton);
  const requestUrl: Locator = patchEndpoint.locator(locators.requestUrl);

  return {
    getEndpoint: patchEndpoint,
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

test.describe('patch by ID', () => {
  test('default values', async ({ page }) => {
    const elements: PatchUserEndpointElements = await setupPatchUserEndpoint(page);
    const defaultRequestBody: UpdatedUser = {
      email: 'user@example.com',
      initials: 'Name Surname',
      oldPassword: 'passWORD1',
      newPassword: 'PASSword2',
    };
    await expect(elements.parametersSection).toBeVisible();
    await expect(elements.idInput).toBeVisible();
    await expect(elements.requestBodySection).toBeVisible();
    await expect(elements.jsonEditor).toBeVisible();
    await elements.idInput.fill(testUserId);
    await elements.jsonEditor.fill(JSON.stringify(defaultRequestBody));
    await elements.executeBtn.click();
    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await expect(elements.requestUrl).toContainText(testUserId);
    await expect(elements.downloadButton).toBeVisible();
    await clearEndpoint(elements.getEndpoint);
  });

  test('custom values', async ({ page }) => {
    const elements: PatchUserEndpointElements = await setupPatchUserEndpoint(page);
    const customRequestBody: UpdatedUser = {
      email: 'patch@example.com',
      initials: 'PT',
      oldPassword: 'oldPatchPass',
      newPassword: 'newPatchPass',
    };
    await elements.idInput.fill(testUserId);
    await elements.jsonEditor.fill(JSON.stringify(customRequestBody));
    await elements.executeBtn.click();
    await expect(elements.curl).toBeVisible();
    await expect(elements.requestUrl).toContainText(testUserId);
    const curlText: string | null = await elements.curl.textContent();
    expect(curlText).toContain('patch@example.com');
    expect(curlText).toContain('PT');
    expect(curlText).toContain('oldPatchPass');
    expect(curlText).toContain('newPatchPass');
    await clearEndpoint(elements.getEndpoint);
  });

  test('empty ID validation', async ({ page }) => {
    const elements: PatchUserEndpointElements = await setupPatchUserEndpoint(page);
    await elements.idInput.fill('');
    await elements.executeBtn.click();
    await expect(elements.idInput).toHaveClass(/invalid/);
    const expectedErrorMsg: string = "For 'id': Required field is not provided.";
    await expect(
      elements.getEndpoint.locator('.validation-errors.errors-wrapper li')
    ).toContainText(expectedErrorMsg);
    await cancelOperation(page);
  });

  test('empty request body', async ({ page }) => {
    const elements: PatchUserEndpointElements = await setupPatchUserEndpoint(page);
    await elements.idInput.fill(testUserId);
    await elements.jsonEditor.clear();
    await elements.executeBtn.click();
    await expect(elements.jsonEditor).toHaveClass(/invalid/);
    await cancelOperation(page);
  });

  test('download', async ({ page }) => {
    const elements: PatchUserEndpointElements = await setupPatchUserEndpoint(page);
    const downloadData: { email: string; initials: string } = {
      email: 'download@example.com',
      initials: 'DL',
    };

    const downloadPromise: Promise<Download> = page.waitForEvent('download');

    await elements.idInput.fill(testUserId);
    await elements.jsonEditor.fill(JSON.stringify(downloadData));
    await elements.executeBtn.click();

    await expect(elements.downloadButton).toBeVisible();
    await expect(elements.downloadButton).toBeEnabled();

    await elements.downloadButton.click();
    const download: Download = await downloadPromise;

    expect(download.suggestedFilename()).toBeTruthy();
    const path: string | null = await download.path();
    expect(path).toBeTruthy();

    await clearEndpoint(elements.getEndpoint);
  });

  test('error response - user not found', async ({ page }) => {
    const elements: PatchUserEndpointElements = await setupPatchUserEndpoint(page);
    const nonExistentId: string = '2b10b7a3-67f0-40ea-a367-44263321592z';
    await interceptWithErrorResponse(
      page,
      PATCH_USER_API_URL(nonExistentId),
      {
        error: 'Not Found',
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      },
      404
    );
    await elements.idInput.fill(nonExistentId);
    await elements.jsonEditor.fill(JSON.stringify({ initials: 'NF' }));
    await elements.executeBtn.click();

    await elements.responseBody.waitFor({ state: 'visible' });

    const responseCode: Locator = elements.getEndpoint
      .locator('.response .response-col_status')
      .first();
    await expect(responseCode).toContainText('404');
    await expect(elements.responseBody).toContainText('User not found');
    await clearEndpoint(elements.getEndpoint);
  });

  test('error response - invalid id format', async ({ page }) => {
    const elements: PatchUserEndpointElements = await setupPatchUserEndpoint(page);
    const invalidId: string = 'invalid-uuid-format';
    await interceptWithErrorResponse(
      page,
      PATCH_USER_API_URL(invalidId),
      {
        error: 'Bad Request',
        message: 'Invalid user ID format',
        code: 'INVALID_ID_FORMAT',
      },
      400
    );
    await elements.idInput.fill(invalidId);
    await elements.jsonEditor.fill(JSON.stringify({ initials: 'NF' }));
    await elements.executeBtn.click();

    await elements.responseBody.waitFor({ state: 'visible' });

    await expect(elements.responseBody).toContainText('Invalid user ID format');
    const responseCode: Locator = elements.getEndpoint
      .locator('.response .response-col_status')
      .first();
    await expect(responseCode).toContainText('400');
    await clearEndpoint(elements.getEndpoint);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: PatchUserEndpointElements = await setupPatchUserEndpoint(page);

    await page.route(PATCH_USER_API_URL(testUserId), route => route.abort('failed'));

    await elements.idInput.fill(testUserId);
    await elements.jsonEditor.fill(JSON.stringify({ initials: 'NF' }));
    await elements.executeBtn.click();

    await elements.responseBody.waitFor({ state: 'visible' });

    await expectErrorOrFailureStatus(elements.getEndpoint);

    await clearEndpoint(elements.getEndpoint);
  });
});
