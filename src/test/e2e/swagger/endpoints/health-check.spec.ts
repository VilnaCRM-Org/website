import { expect, type Locator, test } from '@playwright/test';

import {
  initSwaggerPage,
  clearEndpointResponse,
  getAndCheckExecuteBtn,
  enableTryItOut,
} from '../utils/helpers';
import { getSystemEndpoints, GetSystemEndpoints } from '../utils/index';

test('healthCheck: try it out interaction', async ({ page }) => {
  await initSwaggerPage(page);

  const systemEndpoints: GetSystemEndpoints = getSystemEndpoints(page);
  const healthEndpoint: Locator = systemEndpoints.healthCheck;
  await enableTryItOut(healthEndpoint);

  const executeBtn: Locator = await getAndCheckExecuteBtn(healthEndpoint);

  await executeBtn.click();

  const curl: Locator = healthEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const requestUrl: Locator = healthEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();
  await expect(requestUrl).toContainText('/health');

  await clearEndpointResponse(healthEndpoint);
});
