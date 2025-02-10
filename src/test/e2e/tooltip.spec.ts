import { test, expect, Locator, Page } from '@playwright/test';

import { t } from './utils/initializeLocalization';

const servicesOpenButtonSelector: string = `${t('unlimited_possibilities.service_text.title')}`;
const possibilitiesPluginsCard: string = t(
  'unlimited_possibilities.cards_headings.heading_ready_plugins'
);

const registerOnWebsiteText: string = t('sign_up.form.heading_main');
const servicesTooltipFullText: string = `${t('unlimited_possibilities.service_text.title')} ${t('unlimited_possibilities.service_text.text')}`;

const passwordTipAlt: string = t('sign_up.form.password_tip.alt');
const passwordTipText: string = t('sign_up.form.password_tip.recommendation_text');

async function handleTooltip(
  page: Page,
  { name, element, tooltip }: { name: string; element: Locator; tooltip: Locator }
): Promise<void> {
  const closeLocator: Locator = page.getByRole('heading', { name });
  const elementLocator: Locator = element;

  await page.goto('/');
  await elementLocator.click();
  await expect(tooltip).toBeVisible();

  await closeLocator.click();
  await expect(tooltip).toBeHidden();
}

test.describe('Checking if the tooltips are working', () => {
  test('Tooltip services test', async ({ page }) => {
    await handleTooltip(page, {
      name: possibilitiesPluginsCard,
      element: page.locator('span', { hasText: servicesOpenButtonSelector }).nth(0),
      tooltip: page.getByRole('tooltip', { name: servicesTooltipFullText }),
    });
  });

  test('Tooltip password test', async ({ page }) => {
    await handleTooltip(page, {
      name: registerOnWebsiteText,
      element: page.getByRole('img', { name: passwordTipAlt }),
      tooltip: page.locator('div').filter({ hasText: passwordTipText }).nth(1),
    });
  });
});
