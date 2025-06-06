import { expect, type Locator, test } from '@playwright/test';

import { testUserData, updatedUserData } from '../utils/constants';
import { initSwaggerPage, getAndCheckExecuteBtn, clearEndpoint } from '../utils/helpers';

test('create user: try it out interaction', async ({ page }) => {
  const { userEndpoints, elements } = await initSwaggerPage(page);

  const createEndpoint: Locator = userEndpoints.create;

  await createEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(createEndpoint);

  const requestBodySection: Locator = createEndpoint.locator('.opblock-section-request-body');
  await expect(requestBodySection).toBeVisible();

  const contentTypeSelect: Locator = requestBodySection.locator(
    'select[aria-label="Request content type"]'
  );
  await expect(contentTypeSelect).toBeVisible();
  await expect(contentTypeSelect).toHaveValue('application/json');

  const jsonEditor: Locator = requestBodySection.locator('.body-param__text');
  await expect(jsonEditor).toBeVisible();
  await expect(jsonEditor).toBeEditable();

  await jsonEditor.fill(JSON.stringify(testUserData, null, 2));

  await executeBtn.click();

  const curl: Locator = createEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const copyButton: Locator = createEndpoint.locator('div.copy-to-clipboard button');
  await expect(copyButton).toBeVisible();

  const requestUrl: Locator = createEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();

  await expect(requestUrl).toContainText('/users');

  await expect(jsonEditor).toContainText(testUserData.email);
  await expect(jsonEditor).toContainText(testUserData.initials);

  await clearEndpoint(createEndpoint);

  await expect(curl).not.toBeVisible();

  await jsonEditor.fill(JSON.stringify(updatedUserData, null, 2));
  await executeBtn.click();

  await expect(jsonEditor).toContainText(updatedUserData.email);
  await expect(jsonEditor).toContainText(updatedUserData.initials);

  await expect(curl).toBeVisible();
});
