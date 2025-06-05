import { expect, type Locator, test } from '@playwright/test';

import clearEndpoint from '../utils/clear-endpoint';
import initSwaggerPage from '../utils/init-swagger-page';

test('get user: try it out interaction', async ({ page }) => {
  const { userEndpoints, elements } = await initSwaggerPage(page);

  const getEndpoint: Locator = userEndpoints.getCollection;
  await getEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = getEndpoint.locator('.btn.execute.opblock-control__btn');
  await expect(executeBtn).toBeVisible();

  const pageNumberInput: Locator = getEndpoint.locator(
    'tr[data-param-name="page"] input[placeholder="page"]'
  );
  const itemsPerPageInput: Locator = getEndpoint.locator(
    'tr[data-param-name="itemsPerPage"] input[placeholder="itemsPerPage"]'
  );

  const initialPageValue: string = '1';
  const initialPerPage: string = '30';

  await expect(pageNumberInput).toHaveValue(initialPageValue);
  await expect(itemsPerPageInput).toHaveValue(initialPerPage);

  await executeBtn.click();
  const curl: Locator = getEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const copyButton: Locator = getEndpoint.locator('div.copy-to-clipboard button');
  expect(copyButton).toBeVisible();

  const requestUrl: Locator = getEndpoint.locator('.request-url .microlight');
  const initialPageNumber: string = '1';
  const initialPerPageNumber: string = '30';
  await expect(requestUrl).toContainText(`page=${initialPageNumber}`);
  await expect(requestUrl).toContainText(`itemsPerPage=${initialPerPageNumber}`);

  const clearButton: Locator = getEndpoint.locator('button.btn-clear');
  expect(clearButton).toBeVisible();

  await clearButton.click();
  await expect(curl).not.toBeVisible();

  const changedNumberPage: string = '2';
  const changedPerPageNumber: string = '15';
  await pageNumberInput.fill(changedNumberPage);
  await itemsPerPageInput.fill(changedPerPageNumber);

  await executeBtn.click();
  await expect(requestUrl).toContainText(`page=${changedNumberPage}`);
  await expect(requestUrl).toContainText(`itemsPerPage=${changedPerPageNumber}`);

  await clearEndpoint(getEndpoint);
});
