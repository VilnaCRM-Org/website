import { test, expect, Page } from '@playwright/test';

import { createLocalizedRegExp } from '@/test/e2e/utils/createLocalizedRegExp';

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
  // Both names are RegExps, and `exact` is ignored for a RegExp, so a page-wide
  // lookup would also reach the sign-up form's policy links — whose English copy
  // is now a case variant of the footer's ("Usage Policy" vs "Usage policy").
  // The footer landmark is the surface these two tests are about.
  await page.locator('footer').getByRole('link', { name: linkName, exact: true }).click();
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

  test('Links to usage policy in form', async ({ page }) => {
    await navigateToPrivacyPolicy(page, usePolicyText, companyNameText);
  });
});
