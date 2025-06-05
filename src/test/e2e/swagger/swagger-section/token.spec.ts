import { expect, type Locator, test } from '@playwright/test';

import { getSystemEndpoints, GetSystemEndpoints } from '../utils';
import clearEndpoint from '../utils/clear-endpoint';
import initSwaggerPage from '../utils/init-swagger-page';

test('token: try it out interaction', async ({ page }) => {
  const { elements } = await initSwaggerPage(page);

  const systemEndpoints: GetSystemEndpoints = getSystemEndpoints(page);
  const tokenEndpoint: Locator = systemEndpoints.token;
  await tokenEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = tokenEndpoint.locator('.btn.execute.opblock-control__btn');
  await expect(executeBtn).toBeVisible();

  const requestBodySection: Locator = tokenEndpoint.locator('.opblock-section-request-body');
  await expect(requestBodySection).toBeVisible();

  const contentTypeSelect: Locator = requestBodySection.locator(
    'select[aria-label="Request content type"]'
  );
  await expect(contentTypeSelect).toBeVisible();
  await expect(contentTypeSelect).toHaveValue('application/json');

  const grantTypeInput: Locator = tokenEndpoint.locator('.body-param textarea.body-param__text');
  await expect(grantTypeInput).toBeVisible();
  await grantTypeInput.fill('authorization_code');

  // doesn't work yet
  const codeInput: Locator = tokenEndpoint.locator('input[placeholder="code"]');
  await expect(codeInput).toBeVisible();
  await codeInput.fill('test-auth-code');

  const redirectUriInput: Locator = tokenEndpoint.locator('input[placeholder="redirect_uri"]');
  await expect(redirectUriInput).toBeVisible();
  await redirectUriInput.fill('http://localhost:3000/callback');

  await executeBtn.click();

  const curl: Locator = tokenEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const requestUrl: Locator = tokenEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();
  await expect(requestUrl).toContainText('/oauth/token');

  await clearEndpoint(tokenEndpoint);
});
