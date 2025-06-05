import { expect, type Locator, test } from '@playwright/test';

import initSwaggerPage from '../utils/init-swagger-page';

type UserData = {
  email: string;
  password: string;
  initials: string;
  clientMutationId: string;
};
const testUserData: UserData = {
  email: 'test@example.com',
  password: 'TestPassword123',
  initials: 'TE',
  clientMutationId: 'test-mutation-1',
};

const updatedUserData: UserData = {
  email: 'another@example.com',
  password: 'AnotherPass456',
  initials: 'AN',
  clientMutationId: 'test-mutation-2',
};

test('create user: try it out interaction', async ({ page }) => {
  const { userEndpoints, elements } = await initSwaggerPage(page);

  const createEndpoint: Locator = userEndpoints.create;

  await createEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = createEndpoint.locator('.btn.execute.opblock-control__btn');
  await expect(executeBtn).toBeVisible();

  const requestBodySection: Locator = createEndpoint.locator('.opblock-section-request-body');
  await expect(requestBodySection).toBeVisible();

  const contentTypeSelect: Locator = requestBodySection.locator(
    'select[aria-label="Request content type"]'
  );
  await expect(contentTypeSelect).toBeVisible();
  await expect(contentTypeSelect).toHaveValue('application/json');

  const jsonEditor: Locator = requestBodySection.locator(
    '.opblock-description-wrapper .body-param .body-param__text'
  );
  await expect(jsonEditor).toBeVisible();
  await expect(jsonEditor).toBeEditable();

  await jsonEditor.fill(JSON.stringify(testUserData, null, 2));

  await executeBtn.click();

  const curl: Locator = createEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const copyButton: Locator = createEndpoint.locator('div.copy-to-clipboard button');
  await expect(copyButton).toBeVisible();

  const requestUrl: Locator = createEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toBeVisible();

  await expect(requestUrl).toContainText('/users');

  await expect(jsonEditor).toContainText(testUserData.email);
  await expect(jsonEditor).toContainText(testUserData.initials);

  const clearButton: Locator = createEndpoint.locator('button.btn-clear');
  await expect(clearButton).toBeVisible();
  await clearButton.click();

  await expect(curl).not.toBeVisible();

  await jsonEditor.fill(JSON.stringify(updatedUserData, null, 2));
  await executeBtn.click();

  await expect(jsonEditor).toContainText(updatedUserData.email);
  await expect(jsonEditor).toContainText(updatedUserData.initials);

  await expect(curl).toBeVisible();
});
