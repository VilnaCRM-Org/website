import { expect, Locator, Page } from '@playwright/test';

import { executeBtnSelector } from './constants';

import {
  getLocators,
  getUserEndpoints,
  GetUserEndpoints,
  SwaggerLocators,
  SwaggerPageObjects,
  TEST_CONSTANTS,
} from './index';

export async function clearEndpoint(endpoint: Locator): Promise<void> {
  const clearButton: Locator = endpoint.locator('button.btn-clear');
  const curl: Locator = endpoint.locator('.curl-command');

  await expect(clearButton).toBeVisible();
  await clearButton.click();
  await expect(curl).not.toBeVisible();
}

export async function initSwaggerPage(page: Page): Promise<SwaggerPageObjects> {
  await page.goto(TEST_CONSTANTS.SWAGGER_PATH);

  const userEndpoints: GetUserEndpoints = getUserEndpoints(page);
  const elements: SwaggerLocators = getLocators(page);

  return { userEndpoints, elements };
}

export const getAndCheckExecuteBtn: (element: Locator) => Promise<Locator> = async (
  element: Locator
): Promise<Locator> => {
  const executeBtn: Locator = element.locator(executeBtnSelector);
  await executeBtn.waitFor({ state: 'visible' });

  return executeBtn;
};
