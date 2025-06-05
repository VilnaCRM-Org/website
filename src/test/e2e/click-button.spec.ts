import { Locator, Page, test } from '@playwright/test';

import { createLocalizedRegExp } from '@/test/e2e/utils/createLocalizedRegExp';

import { t } from './utils/initializeLocalization';

const aboutVilnaCRM: RegExp = createLocalizedRegExp('about_vilna.heading_first_main');
const forWho: RegExp = createLocalizedRegExp('for_who.heading_main');
const whyWe: RegExp = createLocalizedRegExp('why_us.heading');

const openDrawerLabel: string = t('header.drawer.button_aria_labels.bars');

const nameOption: { name: RegExp } = {
  name: createLocalizedRegExp('header.actions.try_it_out'),
};

const clickTryItNowButtonByFilteredSection: (
  page: Page,
  uniqueSectionText: string | RegExp
) => Promise<void> = async (page, uniqueSectionText) => {
  await page.locator('section').filter({ hasText: uniqueSectionText }).getByRole('button').click();
};

test.describe('Buttons navigation tests', () => {
  test.beforeEach(async ({ page }) => {
   await page.goto('/', { waitUntil: 'load', timeout: 60000 });
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
