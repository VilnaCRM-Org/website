import { Locator, Page, test } from '@playwright/test';
import { t } from 'i18next';

import '../../../i18n';

const aboutVilnaCRM: RegExp = new RegExp(t('about_vilna.heading_first_main'));
const forWho: RegExp = new RegExp(t('for_who.heading_main'));
const whyWe: RegExp = new RegExp(t('why_us.heading'));

const openDrawerLabel: string = t('header.drawer.button_aria_labels.bars');

const nameOption: { name: RegExp } = { name: new RegExp(t('header.actions.try_it_out')) };

const clickTryItNowButtonByFilteredSection: (
  page: Page,
  uniqueSectionText: string | RegExp
) => Promise<void> = async (page, uniqueSectionText) => {
  await page.locator('section').filter({ hasText: uniqueSectionText }).getByRole('button').click();
};

test.describe('Buttons navigation tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Desktop buttons navigation', async ({ page }) => {
    await page.locator('header').getByRole('button', nameOption).click();
    await clickTryItNowButtonByFilteredSection(page, aboutVilnaCRM);
    await clickTryItNowButtonByFilteredSection(page, forWho);
  });

  test('Mobile button navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await clickTryItNowButtonByFilteredSection(page, aboutVilnaCRM);
    await clickTryItNowButtonByFilteredSection(page, whyWe);
    await clickTryItNowButtonByFilteredSection(page, forWho);
  });

  test('Drawer button navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.getByLabel(openDrawerLabel).click();

    const drawerTryItNowButton: Locator = page.getByRole('button', nameOption);
    await drawerTryItNowButton.click();
  });
});
