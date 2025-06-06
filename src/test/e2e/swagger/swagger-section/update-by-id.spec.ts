import { expect, type Locator, test } from '@playwright/test';

import { testUserId } from '../utils/constants';
import { initSwaggerPage, clearEndpoint, getAndCheckExecuteBtn } from '../utils/helpers';

test('updateById: try it out interaction', async ({ page }) => {
  const { userEndpoints, elements } = await initSwaggerPage(page);

  const updateEndpoint: Locator = userEndpoints.updateById;
  await updateEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(updateEndpoint);

  const parametersSection: Locator = updateEndpoint.locator('.parameters-container');
  await expect(parametersSection).toBeVisible();

  const idInput: Locator = updateEndpoint.locator('input[placeholder="id"]');
  await expect(idInput).toBeVisible();
  await idInput.fill(testUserId);

  const requestBodySection: Locator = updateEndpoint.locator('.opblock-section-request-body');
  await expect(requestBodySection).toBeVisible();

  const jsonEditor: Locator = requestBodySection.locator('.body-param__text');
  await expect(jsonEditor).toBeVisible();

  const updateData: { email: string; initials: string } = {
    email: 'updated@example.com',
    initials: 'UP',
  };
  await jsonEditor.fill(JSON.stringify(updateData, null, 2));
  await executeBtn.click();

  const curl: Locator = updateEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const requestUrl: Locator = updateEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();
  await expect(requestUrl).toContainText(testUserId);

  await clearEndpoint(updateEndpoint);
});
