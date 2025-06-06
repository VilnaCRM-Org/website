import { expect, type Locator, test } from '@playwright/test';

import { batchUserData } from '../utils/constants';
import { initSwaggerPage, clearEndpoint, getAndCheckExecuteBtn } from '../utils/helpers';

test('createBatch: try it out interaction', async ({ page }) => {
  const { userEndpoints, elements } = await initSwaggerPage(page);

  const createBatchEndpoint: Locator = userEndpoints.createBatch;
  await createBatchEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(createBatchEndpoint);

  const requestBodySection: Locator = createBatchEndpoint.locator('.opblock-section-request-body');
  await expect(requestBodySection).toBeVisible();

  const contentTypeSelect: Locator = requestBodySection.locator(
    'select[aria-label="Request content type"]'
  );
  await expect(contentTypeSelect).toBeVisible();
  await expect(contentTypeSelect).toHaveValue('application/json');

  const jsonEditor: Locator = requestBodySection.locator('.body-param__text');
  await expect(jsonEditor).toBeVisible();
  await expect(jsonEditor).toBeEditable();

  await jsonEditor.fill(JSON.stringify(batchUserData, null, 2));
  await executeBtn.click();

  const curl: Locator = createBatchEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const copyButton: Locator = createBatchEndpoint.locator('div.copy-to-clipboard button');
  await expect(copyButton).toBeVisible();

  const requestUrl: Locator = createBatchEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();
  await expect(requestUrl).toContainText('/users/batch');

  await clearEndpoint(createBatchEndpoint);
});
