import { test, expect, Page } from '@playwright/test';
import { t } from 'i18next';

import '../../../i18n';

const vilnaCRMPrivacyPolicyURL: string = process.env
  .NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL as string;
const privacyPolicyText: RegExp = new RegExp(t('footer.privacy'));
const usePolicyText: RegExp = new RegExp(t('footer.usage_policy'));
const companyNameText: RegExp = new RegExp(t('sign_up.vilna_text'));

async function navigateToPrivacyPolicy(
  page: Page,
  linkName: string | RegExp,
  expectedURL: string | RegExp
): Promise<void> {
  await page.route(vilnaCRMPrivacyPolicyURL, route => {
    route.fulfill({
      status: 200,
      body: 'Github Page',
      headers: {
        'Content-Type': 'text/html',
      },
    });
  });
  await page.getByRole('link', { name: linkName, exact: true }).click();
  await page.goto(vilnaCRMPrivacyPolicyURL);
  await page.waitForURL(expectedURL);
  await expect(page).toHaveURL(expectedURL);
}

test.describe('Checking if the links to privacy policy are working', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Links to privacy policy', async ({ page }) => {
    await navigateToPrivacyPolicy(page, privacyPolicyText, companyNameText);
  });
  test('Links to usage policy', async ({ page }) => {
    await navigateToPrivacyPolicy(page, privacyPolicyText, companyNameText);
  });

  test('Links to privacy policy in form', async ({ page }) => {
    await navigateToPrivacyPolicy(page, privacyPolicyText, companyNameText);
  });
  test('Links to usage policy in form', async ({ page }) => {
    await navigateToPrivacyPolicy(page, usePolicyText, companyNameText);
  });
});
