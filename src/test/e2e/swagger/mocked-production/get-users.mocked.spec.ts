import { expect, type Locator, Page, test } from '@playwright/test';

import {
  getAndCheckExecuteBtn,
  initSwaggerPage,
  enableTryItOut,
} from '@/test/e2e/swagger/utils/helpers';

import { mockUsersError, mockUsersSuccess } from './constants';

const mockGetUsers: (page: Page, status: number, response: object) => Promise<void> = async (
  page: Page,
  status: number,
  response: object
): Promise<void> => {
  await page.route('**/users**', async route => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
};

const executeEndpoint: (getEndpoint: Locator) => Promise<void> = async (
  getEndpoint: Locator
): Promise<void> => {
  await enableTryItOut(getEndpoint);
  const executeBtn: Locator = await getAndCheckExecuteBtn(getEndpoint);
  await executeBtn.click();
};

test.describe('Swagger /users endpoint (production with mocks)', () => {
  test.skip(() => process.env.NODE_ENV !== 'production', 'Production-only tests');
  test('should display Swagger page', async ({ page }) => {
    await initSwaggerPage(page);

    const documentation: Locator = page.locator('.swagger-ui');
    const schemeContainer: Locator = page.locator('.scheme-container');

    await expect(documentation).toBeVisible();
    await expect(schemeContainer).toBeVisible();
  });

  test('GET /users should be interactive with mocked success', async ({ page }) => {
    const { userEndpoints } = await initSwaggerPage(page);
    const getEndpoint: Locator = userEndpoints.getCollection;

    await mockGetUsers(page, 200, mockUsersSuccess);

    await executeEndpoint(getEndpoint);

    const curl: Locator = page.locator('.curl-command');
    await expect(curl).toBeVisible();

    const responseWrapper: Locator = getEndpoint.locator('.responses-wrapper');
    await expect(responseWrapper).toContainText('Alice');
    await expect(responseWrapper).toContainText('Bob');
  });

  test('GET /users should handle mocked error response', async ({ page }) => {
    const { userEndpoints } = await initSwaggerPage(page);
    const getEndpoint: Locator = userEndpoints.getCollection;

    await mockGetUsers(page, 500, mockUsersError);

    await executeEndpoint(getEndpoint);

    const curl: Locator = page.locator('.curl-command');
    await expect(curl).toBeVisible();

    const errorRow: Locator = getEndpoint.locator('.responses-wrapper tr', { hasText: '500' });
    await expect(errorRow.locator('.response-col_description__inner')).toContainText(
      'Internal server error'
    );
  });
});
