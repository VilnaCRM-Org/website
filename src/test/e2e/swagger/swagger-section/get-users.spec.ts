import { expect, type Locator, test } from '@playwright/test';

import { initSwaggerPage, clearEndpoint, getAndCheckExecuteBtn } from '../utils/helpers';

test('get user: try it out interaction', async ({ page }) => {
  const { userEndpoints, elements } = await initSwaggerPage(page);

  const getEndpoint: Locator = userEndpoints.getCollection;
  await getEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(getEndpoint);

  const pageNumberInput: Locator = getEndpoint.locator(
    'tr[data-param-name="page"] input[placeholder="page"]'
  );
  const itemsPerPageInput: Locator = getEndpoint.locator(
    'tr[data-param-name="itemsPerPage"] input[placeholder="itemsPerPage"]'
  );

  const initialPageNumber: string = '1';
  const initialPerPageNumber: string = '30';

  await expect(pageNumberInput).toHaveValue(initialPageNumber);
  await expect(itemsPerPageInput).toHaveValue(initialPerPageNumber);

  await executeBtn.click();
  const curl: Locator = getEndpoint.locator('.curl-command');
  await expect(curl).toBeVisible();

  const copyButton: Locator = getEndpoint.locator('div.copy-to-clipboard button');
  await expect(copyButton).toBeVisible();

  const requestUrl: Locator = getEndpoint.locator('.request-url .microlight');
  await expect(requestUrl).toContainText(`page=${initialPageNumber}`);
  await expect(requestUrl).toContainText(`itemsPerPage=${initialPerPageNumber}`);

  await clearEndpoint(getEndpoint);

  const changedNumberPage: string = '2';
  const changedPerPageNumber: string = '15';
  await pageNumberInput.fill(changedNumberPage);
  await itemsPerPageInput.fill(changedPerPageNumber);

  await executeBtn.click();
  await expect(requestUrl).toContainText(`page=${changedNumberPage}`);
  await expect(requestUrl).toContainText(`itemsPerPage=${changedPerPageNumber}`);

  await clearEndpoint(getEndpoint);
});
