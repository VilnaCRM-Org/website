import { test, expect, Page, Locator } from '@playwright/test';

import { createLocalizedRegExp } from '@/test/e2e/utils/createLocalizedRegExp';
import { t } from '@/test/e2e/utils/initializeLocalization';

const vilnaCRMPrivacyPolicyURL: string = process.env
  .NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL as string;
const privacyPolicyText: RegExp = createLocalizedRegExp('footer.privacy');
const usePolicyText: RegExp = createLocalizedRegExp('footer.usage_policy');
const companyNameText: RegExp = createLocalizedRegExp('sign_up.vilna_text');

// The form's confidential-text sentence carries its own Usage Policy copy inside
// a `<3>` tag index (see AuthFormPolicyLinks.test.tsx), distinct from the
// footer's — different case in English, a different word in Ukrainian — so it
// is extracted here rather than reused from `footer.usage_policy`.
const formConfidentialText: string = t('sign_up.form.confidential_text.fullText');
const formUsePolicyText: RegExp = new RegExp(
  formConfidentialText.replace(/^.*<3>(.*?)<\/3>.*$/s, '$1')
);

const mockedPage: string = 'Mocked Page';

async function navigateToPrivacyPolicy(
  page: Page,
  linkScope: Locator,
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
  // Each test therefore scopes the lookup to the landmark it is actually about.
  await linkScope.getByRole('link', { name: linkName, exact: true }).click();
  await page.goto(vilnaCRMPrivacyPolicyURL);
  await page.waitForURL(expectedURL);
  await expect(page).toHaveURL(expectedURL);
}

test.describe('Checking if the links to privacy policy are working', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Links to privacy policy', async ({ page }) => {
    await navigateToPrivacyPolicy(page, page.locator('footer'), privacyPolicyText, companyNameText);
  });

  test('Links to usage policy in footer', async ({ page }) => {
    await navigateToPrivacyPolicy(page, page.locator('footer'), usePolicyText, companyNameText);
  });

  test('Links to usage policy in form', async ({ page }) => {
    await navigateToPrivacyPolicy(page, page.getByRole('form'), formUsePolicyText, companyNameText);
  });
});
