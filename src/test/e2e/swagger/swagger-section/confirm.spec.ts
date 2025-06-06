import { expect, type Locator, test } from '@playwright/test';

import { testConfirmationToken } from '../utils/constants';
import { initSwaggerPage, clearEndpoint, getAndCheckExecuteBtn } from '../utils/helpers';

const apiUrl: string = `${process.env.API_BASE_URL || 'https://api.vilnacrm.com'}/api/users/confirm`;

test('confirm: try it out interaction', async ({ page }) => {
  const { userEndpoints, elements } = await initSwaggerPage(page);

  const confirmEndpoint: Locator = userEndpoints.confirm;
  await confirmEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(confirmEndpoint);

  const parametersSection: Locator = confirmEndpoint.locator('.parameters-container');
  await expect(parametersSection).toBeVisible();

  const tokenInput: Locator = confirmEndpoint.locator('.body-param textarea.body-param__text');
  await expect(tokenInput).toBeVisible();
  await tokenInput.fill(testConfirmationToken);

  await executeBtn.click();

  const curl: Locator = confirmEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const curlBody: Locator = confirmEndpoint.locator('.curl .language-bash');
  await expect(curlBody).toContainText(testConfirmationToken);

  const requestUrl: Locator = confirmEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();
  await expect(requestUrl).toContainText(apiUrl);

  await clearEndpoint(confirmEndpoint);
});
