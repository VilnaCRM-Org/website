import { test, expect, Locator } from '@playwright/test';

import { t } from './utils/initializeLocalization';

const BASE_URL: string = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://prod:3001';

const escapeRegExp: (value: string) => string = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createNamePattern: (names: string[]) => RegExp = (names: string[]): RegExp =>
  new RegExp(`^(?:${names.map(escapeRegExp).join('|')})$`, 'i');

const logoNamePattern: RegExp = createNamePattern([
  t('header.logo_alt'),
  t('header.logo_alt', { lng: 'en' }),
]);

const drawerOpenPattern: RegExp = createNamePattern([
  t('header.drawer.button_aria_labels.bars'),
  t('header.drawer.button_aria_labels.bars', { lng: 'en' }),
]);

test.describe('Logo navigation', () => {
  test('Header logo navigates to home', async ({ page }) => {
    await page.goto('/en/docs/api');

    await page.getByRole('link', { name: logoNamePattern }).click();

    await expect(page).toHaveURL(`${BASE_URL}/`);
  });

  test('Drawer logo navigates to home', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/en/docs/api');

    await page.getByRole('button', { name: drawerOpenPattern }).click();

    const drawer: Locator = page.getByRole('menu');
    await expect(drawer).toBeVisible();

    await drawer.getByRole('link', { name: logoNamePattern }).click();

    await expect(page).toHaveURL(`${BASE_URL}/`);
  });
});
