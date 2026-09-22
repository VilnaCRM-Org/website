import { test, expect, Page, Locator } from '@playwright/test';

import { createLocalizedRegExp } from '@/test/e2e/utils/createLocalizedRegExp';
import { t } from '@/test/e2e/utils/initializeLocalization';

const vilnaCRMPrivacyPolicyURL: string = process.env
  .NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL as string;
const privacyPolicyText: RegExp = createLocalizedRegExp('footer.privacy');
const usePolicyText: RegExp = createLocalizedRegExp('footer.usage_policy');
const companyNameText: RegExp = createLocalizedRegExp('sign_up.vilna_text');

// Differs in case/wording from the footer's copy (see AuthFormPolicyLinks.test.tsx),
// so it's extracted here rather than reused from `footer.usage_policy`.
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
  // `exact` is ignored for RegExp names, so an unscoped lookup would also match
  // the sign-up form's policy link; each test scopes to its own landmark.
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
