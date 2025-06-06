import { expect, type Locator, test } from '@playwright/test';

import { getSystemEndpoints, GetSystemEndpoints } from '../utils';
import { initSwaggerPage, clearEndpoint, getAndCheckExecuteBtn } from '../utils/helpers';

test('authorize: try it out interaction', async ({ page }) => {
  const { elements } = await initSwaggerPage(page);

  const systemEndpoints: GetSystemEndpoints = getSystemEndpoints(page);
  const authorizeEndpoint: Locator = systemEndpoints.authorize;
  await authorizeEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(authorizeEndpoint);

  const parametersSection: Locator = authorizeEndpoint.locator('.parameters-container');
  await expect(parametersSection).toBeVisible();

  const responseTypeInput: Locator = authorizeEndpoint.locator(
    'input[placeholder="response_type"]'
  );
  await expect(responseTypeInput).toBeVisible();
  await responseTypeInput.fill('code');

  const clientIdInput: Locator = authorizeEndpoint.locator('input[placeholder="client_id"]');
  await expect(clientIdInput).toBeVisible();
  await clientIdInput.fill('test-client');

  const redirectUriInput: Locator = authorizeEndpoint.locator('input[placeholder="redirect_uri"]');
  await expect(redirectUriInput).toBeVisible();
  await redirectUriInput.fill('http://localhost:3000/callback');

  await executeBtn.click();

  const curl: Locator = authorizeEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const requestUrl: Locator = authorizeEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();
  await expect(requestUrl).toContainText('/oauth/authorize');

  await clearEndpoint(authorizeEndpoint);
});
