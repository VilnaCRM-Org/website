import { test, expect, Page } from '@playwright/test';

import { t } from './utils/initializeLocalization';

const WEBSITE_URL: string = process.env.NEXT_PUBLIC_PRODUCTION_API_URL || 'http://prod:3001';
const links: Record<string, string> = {
  advantages: `${WEBSITE_URL}/#Advantages`,
  forWho: `${WEBSITE_URL}/#forWhoSection`,
  integration: `${WEBSITE_URL}/#Integration`,
  contacts: `${WEBSITE_URL}/#Contacts`,
};

const drawerTestId: string = 'drawer';
const advantagesNavLink: string = t('header.advantages');
const forWhoNavLink: string = t('header.for_who');
const integrationNavLink: string = t('header.integration');
const contactsNavLink: string = t('header.contacts');
const labelButtonToOpenDrawer: string = t('header.drawer.button_aria_labels.bars');

async function navigateAndExpect(
  page: Page,
  linkName: string,
  expectedURL: string | RegExp
): Promise<void> {
  await page.getByRole('link', { name: linkName }).click();
  await expect(page).toHaveURL(expectedURL);
}

async function openDrawerAndNavigate(
  page: Page,
  linkName: string,
  expectedURL: string | RegExp
): Promise<void> {
  await page.getByLabel(labelButtonToOpenDrawer).click();
  await page.getByRole('link', { name: linkName }).click();
  await expect(page.getByTestId(drawerTestId)).toBeHidden();
  await expect(page).toHaveURL(expectedURL);
}

test.describe('Checking if the navigation links are working', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Header links', async ({ page }) => {
    await navigateAndExpect(page, advantagesNavLink, links.advantages);
    await navigateAndExpect(page, forWhoNavLink, links.forWho);
    await navigateAndExpect(page, integrationNavLink, links.integration);
    await navigateAndExpect(page, contactsNavLink, links.contacts);
  });

  test('Navigate drawer links', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await openDrawerAndNavigate(page, advantagesNavLink, links.advantages);
    await openDrawerAndNavigate(page, forWhoNavLink, links.forWho);
    await openDrawerAndNavigate(page, integrationNavLink, links.integration);
    await openDrawerAndNavigate(page, contactsNavLink, links.contacts);
  });
});
