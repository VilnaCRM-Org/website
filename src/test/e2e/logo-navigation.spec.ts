import { expect, test } from '@playwright/test';

import { t } from './utils/initializeLocalization';

const BASE_URL: string = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://prod:3001';
const logoLabel = t('header.logo_alt');
const drawerToggleLabel = t('header.drawer.button_aria_labels.bars');
const drawerTestId = 'drawer';

test.describe('Logo navigation', () => {
  test('header logo navigates home from a deep link', async ({ page }) => {
    await page.goto('/swagger');

    await page.getByRole('link', { name: logoLabel }).click();

    await expect(page).toHaveURL(`${BASE_URL}/`);
  });

  test('drawer logo navigates home and closes the drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/swagger');

    await page.getByLabel(drawerToggleLabel).click();
    await page.getByRole('link', { name: logoLabel }).click();

    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect(page.getByTestId(drawerTestId)).toBeHidden();
  });
});
