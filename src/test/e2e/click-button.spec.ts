import { Locator, Page, test, expect } from '@playwright/test';

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
  const link: Locator = page
    .locator('section')
    .filter({ hasText: uniqueSectionText })
    .getByRole('link', nameOption);

  await expect(link).toHaveCount(1);
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeVisible();
  await link.click();
};

test.describe('Buttons navigation tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Desktop buttons navigation', async ({ page }) => {
    await page.locator('header').getByRole('link', nameOption).click();
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

    // `dialog`, not `menu`: the drawer no longer overrides the modal root's role
    // (that failed axe's `aria-required-children`, #369). MUI's temporary Drawer
    // already exposes its paper as an `aria-modal` dialog.
    const drawerContainer: Locator = page.getByRole('dialog');
    const drawerTryItNowButton: Locator = drawerContainer.getByRole('link', nameOption);
    await drawerTryItNowButton.click();
  });
});
