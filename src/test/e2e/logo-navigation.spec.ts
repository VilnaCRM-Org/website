import { expect, Locator, test } from '@playwright/test';

import swaggerEnTranslations from '../../features/swagger/i18n/en.json';

type SwaggerNavigationTranslation = {
  navigation: {
    navigate_to_home_page: string;
  };
};

const BASE_URL: string = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'http://prod:3001';
const navigateHomeText: string = (swaggerEnTranslations as SwaggerNavigationTranslation).navigation
  .navigate_to_home_page;

test.describe('Swagger navigation', () => {
  test('back navigation navigates home from a deep link', async ({ page }) => {
    await page.goto('/swagger');

    const navigationButton: Locator = page.getByText(navigateHomeText, { exact: true });
    await expect(navigationButton).toBeVisible();

    await navigationButton.click();

    await expect(page).toHaveURL(`${BASE_URL}/`);
  });

  test('back navigation works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/swagger');

    const navigationButton: Locator = page.getByText(navigateHomeText, { exact: true });
    await expect(navigationButton).toBeVisible();

    await navigationButton.click();

    await expect(page).toHaveURL(`${BASE_URL}/`);
  });
});
