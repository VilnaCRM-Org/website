import { expect, type Locator, test } from '@playwright/test';

import { getSystemEndpoints, GetSystemEndpoints } from '../utils';
import clearEndpoint from '../utils/clear-endpoint';
import initSwaggerPage from '../utils/init-swagger-page';

interface OAuthRequest {
  grant_type: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  code?: string;
  refresh_token?: string;
}

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

  const rawValue: string = await grantTypeInput.inputValue();

  const json: OAuthRequest = JSON.parse(rawValue);

  json.grant_type = 'new_authorization_code';
  json.client_id = 'new_client_id_123';
  json.code = 'new_code_456';

  await grantTypeInput.fill(JSON.stringify(json, null, 2));

  await executeBtn.click();

  const curl: Locator = tokenEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const curlUrl: Locator = tokenEndpoint.locator('.request-url .microlight');
  await expect(curlUrl).toBeVisible();
  await expect(curlUrl).toContainText('/oauth/token');

  const curlBody: Locator = tokenEndpoint.locator('.curl-command pre.curl.microlight');
  await expect(curlBody).toBeVisible();
  await expect(curlBody).toContainText('"grant_type": "new_authorization_code"');
  await expect(curlBody).toContainText('"client_id": "new_client_id_123"');
  await expect(curlBody).toContainText('"code": "new_code_456"');

  await clearEndpoint(tokenEndpoint);
});
