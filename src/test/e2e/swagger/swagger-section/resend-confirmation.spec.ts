import { expect, type Locator, test } from '@playwright/test';

import { testUserId } from '../utils/constants';
import { initSwaggerPage, clearEndpoint, getAndCheckExecuteBtn } from '../utils/helpers';

test('resendConfirmation: try it out interaction', async ({ page }) => {
  const { userEndpoints, elements } = await initSwaggerPage(page);

  const resendEndpoint: Locator = userEndpoints.resendConfirmation;
  await resendEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(resendEndpoint);

  const idInput: Locator = resendEndpoint.locator('input[placeholder="id"]');
  await expect(idInput).toBeVisible();
  await idInput.fill(testUserId);

  await executeBtn.click();

  const curl: Locator = resendEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const requestUrl: Locator = resendEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();
  await expect(requestUrl).toContainText(testUserId);
  await expect(requestUrl).toContainText('resend-confirmation-email');

  await clearEndpoint(resendEndpoint);
});
