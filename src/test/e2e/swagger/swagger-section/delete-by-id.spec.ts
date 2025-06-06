import { expect, type Locator, test } from '@playwright/test';

import { testUserId } from '../utils/constants';
import { getAndCheckExecuteBtn, initSwaggerPage, clearEndpoint } from '../utils/helpers';

test('deleteById: try it out interaction', async ({ page }) => {
  const { userEndpoints, elements } = await initSwaggerPage(page);

  const deleteEndpoint: Locator = userEndpoints.deleteById;
  await deleteEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(deleteEndpoint);

  const idInput: Locator = deleteEndpoint.locator('input[placeholder="id"]');
  await expect(idInput).toBeVisible();
  await idInput.fill(testUserId);

  await executeBtn.click();

  const curl: Locator = deleteEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const requestUrl: Locator = deleteEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();
  await expect(requestUrl).toContainText(testUserId);

  await clearEndpoint(deleteEndpoint);
});
