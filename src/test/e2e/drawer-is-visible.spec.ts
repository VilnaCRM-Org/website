import { test, expect, Page } from '@playwright/test';

import { t } from './utils/initializeLocalization';

const labelButtonToOpenDrawer: string = t('header.drawer.button_aria_labels.bars');
const labelButtonToExitDrawer: string = t('header.drawer.button_aria_labels.exit');

async function openDrawer(page: Page): Promise<void> {
  await page.getByLabel(labelButtonToOpenDrawer).click();
  await expect(page.getByRole('presentation')).toBeVisible();
}

async function closeDrawer(page: Page): Promise<void> {
  await page.getByLabel(labelButtonToExitDrawer).click();
  await expect(page.getByRole('presentation')).toBeHidden();
}

test('Checking whether the drawer opens and closes', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 450, height: 812 });

  await openDrawer(page);
  await closeDrawer(page);

  await openDrawer(page);
  await page.setViewportSize({ width: 1024, height: 812 });

  await expect(page.getByRole('presentation')).toBeHidden();
});
