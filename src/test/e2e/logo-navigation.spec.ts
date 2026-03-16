import { expect, Locator, Page, test } from '@playwright/test';

import headerEnTranslations from '../../features/landing/i18n/en.json';

type HeaderTranslation = {
  header: {
    logo_alt: string;
  };
};

const logoAlt: string = (headerEnTranslations as HeaderTranslation).header.logo_alt;

async function expectLogoNavigatesHome(page: Page, logoLink: Locator): Promise<void> {
  const expectedOrigin: string = new URL(page.url()).origin;

  await Promise.all([
    page.waitForURL(
      url => {
        const targetUrl: URL = new URL(url);
        return targetUrl.origin === expectedOrigin && targetUrl.pathname === '/';
      },
      { timeout: 15000 }
    ),
    logoLink.click(),
  ]);
}

test.describe('Logo navigation', () => {
  test('logo navigates home from a deep link', async ({ page }) => {
    await page.goto('/swagger', { waitUntil: 'domcontentloaded' });

    const logoLink: Locator = page.getByRole('link', { name: logoAlt });
    await expect(logoLink).toBeVisible({ timeout: 15000 });

    await expectLogoNavigatesHome(page, logoLink);
  });

  test('logo navigation works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/swagger', { waitUntil: 'domcontentloaded' });

    const logoLink: Locator = page.getByRole('link', { name: logoAlt });
    await expect(logoLink).toBeVisible({ timeout: 15000 });

    await expectLogoNavigatesHome(page, logoLink);
  });
});
