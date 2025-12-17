import { expect, Locator, test } from '@playwright/test';

import headerEnTranslations from '../../features/landing/i18n/en.json';

type HeaderTranslation = {
  header: {
    logo_alt: string;
  };
};

const BASE_URL: string = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'http://prod:3001';
const logoAlt: string = (headerEnTranslations as HeaderTranslation).header.logo_alt;

test.describe('Logo navigation', () => {
  test('logo navigates home from a deep link', async ({ page }) => {
    await page.goto('/swagger');

    const logoLink: Locator = page.getByRole('link', { name: logoAlt });
    await expect(logoLink).toBeVisible();

    await logoLink.click();

    await expect(page).toHaveURL(`${BASE_URL}/`);
  });

  test('logo navigation works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/swagger');

    const logoLink: Locator = page.getByRole('link', { name: logoAlt });
    await expect(logoLink).toBeVisible();

    await logoLink.click();

    await expect(page).toHaveURL(`${BASE_URL}/`);
  });
});
