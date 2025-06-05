import { expect, type Locator, test } from '@playwright/test';

import clearEndpoint from '../utils/clear-endpoint';
import initSwaggerPage from '../utils/init-swagger-page';

const updateData: { email: string; initials: string } = {
  email: 'updated@example.com',
  initials: 'UP',
};

test('updateById: try it out interaction', async ({ page }) => {
  const { userEndpoints, elements } = await initSwaggerPage(page);

  const updateEndpoint: Locator = userEndpoints.updateById;
  await updateEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = updateEndpoint.locator('.btn.execute.opblock-control__btn');
  await expect(executeBtn).toBeVisible();

  const parametersSection: Locator = updateEndpoint.locator('.parameters-container');
  await expect(parametersSection).toBeVisible();

  const idInput: Locator = updateEndpoint.locator('input[placeholder="id"]');
  await expect(idInput).toBeVisible();
  await idInput.fill('test-user-id');

  const requestBodySection: Locator = updateEndpoint.locator('.opblock-section-request-body');
  await expect(requestBodySection).toBeVisible();

  const jsonEditor: Locator = requestBodySection.locator('.body-param__text');
  await expect(jsonEditor).toBeVisible();

  await jsonEditor.fill(JSON.stringify(updateData, null, 2));
  await executeBtn.click();

  const curl: Locator = updateEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const requestUrl: Locator = updateEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();
  await expect(requestUrl).toContainText('test-user-id');

  await clearEndpoint(updateEndpoint);
});
