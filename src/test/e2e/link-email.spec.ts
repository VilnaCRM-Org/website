import { test, expect, Locator, Page } from '@playwright/test';

import { t } from './utils/initializeLocalization';

const labelButtonToOpenDrawer: string = t('header.drawer.button_aria_labels.bars');
const vilnaCRMEmail: string = t('footer.vilna_email');

async function verifyEmailLink(page: Page, linkName: string): Promise<void> {
  const linkSelector: Locator = page.getByRole('link', { name: linkName });
  await expect(linkSelector).toHaveAttribute('href', `mailto:${linkName}`);
}

test.describe('Verify email', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Footer email', async ({ page }) => {
    await verifyEmailLink(page, vilnaCRMEmail);
  });

  test('Drawer email', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.getByLabel(labelButtonToOpenDrawer).click();
    await verifyEmailLink(page, vilnaCRMEmail);
  });
});
