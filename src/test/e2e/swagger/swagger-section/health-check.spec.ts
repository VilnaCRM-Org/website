import { expect, type Locator, test } from '@playwright/test';

import { getSystemEndpoints, GetSystemEndpoints } from '../utils/index';
import initSwaggerPage from '../utils/init-swagger-page';

test('healthCheck: try it out interaction', async ({ page }) => {
  const { elements } = await initSwaggerPage(page);

  const systemEndpoints: GetSystemEndpoints = getSystemEndpoints(page);
  const healthEndpoint: Locator = systemEndpoints.healthCheck;
  await healthEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = healthEndpoint.locator('.btn.execute.opblock-control__btn');
  await expect(executeBtn).toBeVisible();
  await executeBtn.click();

  const curl: Locator = healthEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const requestUrl: Locator = healthEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();
  await expect(requestUrl).toContainText('/health');

  const clearButton: Locator = healthEndpoint.locator('button.btn-clear');
  await clearButton.click();
  await expect(curl).not.toBeVisible();
});
