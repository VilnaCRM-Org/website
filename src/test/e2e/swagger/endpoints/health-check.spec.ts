import { expect, type Locator, test } from '@playwright/test';

import { initSwaggerPage, clearEndpointResponse, getAndCheckExecuteBtn } from '../utils/helpers';
import { getSystemEndpoints, GetSystemEndpoints } from '../utils/index';

test('healthCheck: try it out interaction', async ({ page }) => {
  const { elements } = await initSwaggerPage(page);

  const systemEndpoints: GetSystemEndpoints = getSystemEndpoints(page);
  const healthEndpoint: Locator = systemEndpoints.healthCheck;
  await healthEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(healthEndpoint);

  await executeBtn.click();

  const curl: Locator = healthEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const requestUrl: Locator = healthEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();
  await expect(requestUrl).toContainText('/health');

  await clearEndpointResponse(healthEndpoint);
});
