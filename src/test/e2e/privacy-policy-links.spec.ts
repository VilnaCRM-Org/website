import { test, expect, Page } from '@playwright/test';

import  createLocalizedRegExp  from '@/test/e2e/utils/createLocalizedRegExp';

const vilnaCRMPrivacyPolicyURL: string = process.env
  .NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL as string;
const privacyPolicyText: RegExp = createLocalizedRegExp('footer.privacy');
const usePolicyText: RegExp = createLocalizedRegExp('footer.usage_policy');
const companyNameText: RegExp = createLocalizedRegExp('sign_up.vilna_text');

const mockedPage: string = 'Mocked Page';

async function navigateToPrivacyPolicy(
  page: Page,
  linkName: string | RegExp,
  expectedURL: string | RegExp
): Promise<void> {
  await page.route(vilnaCRMPrivacyPolicyURL, route => {
    route.fulfill({
      status: 200,
      body: mockedPage,
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
   await page.goto('/', { waitUntil: 'load', timeout: 30000 });
  });

  test('Links to privacy policy', async ({ page }) => {
    await navigateToPrivacyPolicy(page, privacyPolicyText, companyNameText);
  });

  test('Links to usage policy in form', async ({ page }) => {
    await navigateToPrivacyPolicy(page, usePolicyText, companyNameText);
  });
});
