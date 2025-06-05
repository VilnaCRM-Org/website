import { expect, type Locator, test } from '@playwright/test';

import clearEndpoint from '../utils/clear-endpoint';
import initSwaggerPage from '../utils/init-swagger-page';

test('deleteById: try it out interaction', async ({ page }) => {
  const { userEndpoints, elements } = await initSwaggerPage(page);

  const deleteEndpoint: Locator = userEndpoints.deleteById;
  await deleteEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = deleteEndpoint.locator('.btn.execute.opblock-control__btn');
  await expect(executeBtn).toBeVisible();

  const idInput: Locator = deleteEndpoint.locator('input[placeholder="id"]');
  await expect(idInput).toBeVisible();
  await idInput.fill('test-user-id');

  await executeBtn.click();

  const curl: Locator = deleteEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const requestUrl: Locator = deleteEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();
  await expect(requestUrl).toContainText('test-user-id');

  await clearEndpoint(deleteEndpoint);
});
