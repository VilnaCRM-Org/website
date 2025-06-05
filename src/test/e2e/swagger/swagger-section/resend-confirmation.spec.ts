import { expect, type Locator, test } from '@playwright/test';

import clearEndpoint from '../utils/clear-endpoint';
import initSwaggerPage from '../utils/init-swagger-page';

test('resendConfirmation: try it out interaction', async ({ page }) => {
  const { userEndpoints, elements } = await initSwaggerPage(page);

  const resendEndpoint: Locator = userEndpoints.resendConfirmation;
  await resendEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = resendEndpoint.locator('.btn.execute.opblock-control__btn');
  await expect(executeBtn).toBeVisible();

  const idInput: Locator = resendEndpoint.locator('input[placeholder="id"]');
  await expect(idInput).toBeVisible();
  await idInput.fill('test-user-id');

  await executeBtn.click();

  const curl: Locator = resendEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const requestUrl: Locator = resendEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();
  await expect(requestUrl).toContainText('test-user-id');
  await expect(requestUrl).toContainText('resend-confirmation-email');

  await clearEndpoint(resendEndpoint);
});
