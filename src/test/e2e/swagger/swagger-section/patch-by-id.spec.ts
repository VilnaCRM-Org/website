import { expect, type Locator, test } from '@playwright/test';

import { testUserId, userInitials } from '../utils/constants';
import { initSwaggerPage, clearEndpoint, getAndCheckExecuteBtn } from '../utils/helpers';

const patchData: { initials: string } = {
  initials: userInitials,
};

test('patchById: try it out interaction', async ({ page }) => {
  const { userEndpoints, elements } = await initSwaggerPage(page);

  const patchEndpoint: Locator = userEndpoints.patchById;

  await patchEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(patchEndpoint);

  const parametersSection: Locator = patchEndpoint.locator('.parameters-container');
  await expect(parametersSection).toBeVisible();

  const idInput: Locator = patchEndpoint.locator('input[placeholder="id"]');
  await expect(idInput).toBeVisible();
  await idInput.fill(testUserId);

  const requestBodySection: Locator = patchEndpoint.locator('.opblock-section-request-body');
  await expect(requestBodySection).toBeVisible();

  const jsonEditor: Locator = requestBodySection.locator('.body-param__text');
  await expect(jsonEditor).toBeVisible();

  await jsonEditor.fill(JSON.stringify(patchData));
  await executeBtn.click();

  const curl: Locator = patchEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const requestUrl: Locator = patchEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();
  await expect(requestUrl).toContainText(testUserId);

  await clearEndpoint(patchEndpoint);
});
