import { expect, type Locator, Page, test, type Download } from '@playwright/test';

import { BASE_API, BasicEndpointElements, MOCK_API_USER, UpdatedUser } from '../utils/constants';
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
  expectOnlyDocumentedId,
  selectDocumentedId,
} from '../utils/helpers';
import { locators } from '../utils/locators';

interface PatchUserEndpointElements extends BasicEndpointElements {
  parametersSection: Locator;
  idSelect: Locator;
  requestBodySection: Locator;
  jsonEditor: Locator;
  curl: Locator;
  copyButton: Locator;
  downloadButton: Locator;
}

const PATCH_USER_API_URL: (id: string) => string = (id: string): string =>
  `${buildSafeUrl(BASE_API, encodeURIComponent(id))}**`;

async function setupPatchUserEndpoint(page: Page): Promise<PatchUserEndpointElements> {
  const { userEndpoints, elements } = await initSwaggerPage(page);
  const patchEndpoint: Locator = userEndpoints.patchById;

  await patchEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(patchEndpoint);
  const parametersSection: Locator = patchEndpoint.locator(locators.parametersSection);
  const idSelect: Locator = patchEndpoint.locator(locators.idSelect);
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
    idSelect,
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
    const userId: string = await selectDocumentedId(elements.idSelect);
    await interceptWithJsonResponse(page, PATCH_USER_API_URL(userId), MOCK_API_USER);
    const defaultRequestBody: UpdatedUser = {
      email: 'user@example.com',
      initials: 'Name Surname',
      oldPassword: 'passWORD1',
      newPassword: 'PASSword2',
    };
    await expect(elements.parametersSection).toBeVisible();
    await expect(elements.idSelect).toBeVisible();
    await expect(elements.requestBodySection).toBeVisible();
    await expect(elements.jsonEditor).toBeVisible();
    await elements.jsonEditor.fill(JSON.stringify(defaultRequestBody));
    await elements.executeBtn.click();
    await expect(elements.curl).toBeVisible();
    await expect(elements.copyButton).toBeVisible();
    await expect(elements.requestUrl).toContainText(userId);
    await expect(elements.downloadButton).toBeVisible();
    await clearEndpointResponse(elements.getEndpoint);
  });

  test('custom values', async ({ page }) => {
    const elements: PatchUserEndpointElements = await setupPatchUserEndpoint(page);
    const userId: string = await selectDocumentedId(elements.idSelect);
    await interceptWithJsonResponse(page, PATCH_USER_API_URL(userId), MOCK_API_USER);
    const customRequestBody: UpdatedUser = {
      email: 'patch@example.com',
      initials: 'PT',
      oldPassword: 'oldPatchPass',
      newPassword: 'newPatchPass',
    };
    await elements.jsonEditor.fill(JSON.stringify(customRequestBody));
    await elements.executeBtn.click();
    await expect(elements.curl).toBeVisible();
    await expect(elements.requestUrl).toContainText(userId);
    const curlText: string | null = await elements.curl.textContent();
    expect(curlText).toContain('patch@example.com');
    expect(curlText).toContain('PT');
    expect(curlText).toContain('oldPatchPass');
    expect(curlText).toContain('newPatchPass');
    await clearEndpointResponse(elements.getEndpoint);
  });

  test('empty request body', async ({ page }) => {
    const elements: PatchUserEndpointElements = await setupPatchUserEndpoint(page);
    await selectDocumentedId(elements.idSelect);
    await elements.jsonEditor.clear();
    await elements.executeBtn.click();
    await expect(elements.jsonEditor).toHaveClass(/invalid/);
    await cancelOperation(page);
  });

  test('download', async ({ page }) => {
    const elements: PatchUserEndpointElements = await setupPatchUserEndpoint(page);
    const userId: string = await selectDocumentedId(elements.idSelect);
    await interceptWithJsonResponse(page, PATCH_USER_API_URL(userId), MOCK_API_USER);
    const downloadData: { email: string; initials: string } = {
      email: 'download@example.com',
      initials: 'DL',
    };

    const downloadPromise: Promise<Download> = page.waitForEvent('download');
    await elements.jsonEditor.fill(JSON.stringify(downloadData));
    await elements.executeBtn.click();

    await expect(elements.downloadButton).toBeVisible();
    await expect(elements.downloadButton).toBeEnabled();

    await elements.downloadButton.click();
    const download: Download = await downloadPromise;

    expect(download.suggestedFilename()).toBeTruthy();
    const path: string | null = await download.path();
    expect(path).toBeTruthy();

    await clearEndpointResponse(elements.getEndpoint);
  });

  test('error response - user not found', async ({ page }) => {
    const elements: PatchUserEndpointElements = await setupPatchUserEndpoint(page);
    const userId: string = await selectDocumentedId(elements.idSelect);
    await interceptWithErrorResponse(
      page,
      PATCH_USER_API_URL(userId),
      {
        error: 'Not Found',
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      },
      404
    );
    await elements.jsonEditor.fill(JSON.stringify({ initials: 'NF' }));
    await elements.executeBtn.click();

    await elements.responseBody.waitFor({ state: 'visible' });

    const responseCode: Locator = elements.getEndpoint
      .locator('.response .response-col_status')
      .first();
    await expect(responseCode).toContainText('404');
    await expect(elements.responseBody).toContainText('User not found');
    await clearEndpointResponse(elements.getEndpoint);
  });

  test('only the documented user id can be sent', async ({ page }) => {
    const elements: PatchUserEndpointElements = await setupPatchUserEndpoint(page);

    await expectOnlyDocumentedId(elements.idSelect);

    await cancelOperation(page);
  });

  test('error response - CORS/Network failure', async ({ page }) => {
    const elements: PatchUserEndpointElements = await setupPatchUserEndpoint(page);
    const userId: string = await selectDocumentedId(elements.idSelect);

    await interceptWithNetworkFailure(page, PATCH_USER_API_URL(userId));
    await elements.jsonEditor.fill(JSON.stringify({ initials: 'NF' }));
    await elements.executeBtn.click();

    await elements.responseBody.waitFor({ state: 'visible' });

    await expectErrorOrFailureStatus(elements.getEndpoint);

    await clearEndpointResponse(elements.getEndpoint);
  });
});
