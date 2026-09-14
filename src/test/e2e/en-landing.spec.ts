import { expect, Locator, Page, test } from '@playwright/test';
import i18n from 'i18next';

import { absoluteUrl } from '@/config/site';

import './utils/initializeLocalization';

type FixedT = (key: string) => string;

const en: FixedT = i18n.getFixedT('en');
const uk: FixedT = i18n.getFixedT('uk');

const EN_LANDING: string = '/en';
const UK_LANDING: string = '/';

async function expectLandingLanguage(page: Page, lang: string, t: FixedT): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await expect(page).toHaveTitle(t('seo.landing.title'));
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
    'content',
    lang === 'en' ? 'en_US' : 'uk_UA'
  );

  const heading: Locator = page.getByRole('heading', {
    name: new RegExp(t('about_vilna.heading_first_main')),
  });
  await expect(heading).toBeVisible();
  await expect(
    page
      .getByRole('link', { name: t('header.advantages') })
      .filter({ visible: true })
      .first()
  ).toBeVisible();
  await expect(
    page.getByText(t('footer.copyright')).filter({ visible: true }).first()
  ).toBeVisible();
}

test.describe('English landing at /en', () => {
  test('renders the whole page in English, with an English document language', async ({ page }) => {
    await page.goto(EN_LANDING);

    await expectLandingLanguage(page, 'en', en);
    await expect(page.getByText(uk('about_vilna.heading_first_main'))).toHaveCount(0);
    await expect(page.getByText('ТОВ')).toHaveCount(0);
  });

  test('declares itself and the Ukrainian landing as hreflang alternates', async ({ page }) => {
    await page.goto(EN_LANDING);

    const alternates: Locator = page.locator('link[rel="alternate"][hreflang]');
    await expect(alternates).toHaveCount(3);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      absoluteUrl('/en')
    );
    await expect(page.locator('link[rel="alternate"][hreflang="uk"]')).toHaveAttribute(
      'href',
      absoluteUrl('/')
    );
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      'href',
      absoluteUrl('/')
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', absoluteUrl('/en'));
  });

  test('keeps header navigation inside the English page', async ({ page }) => {
    await page.goto(EN_LANDING);

    await page
      .getByRole('link', { name: en('header.advantages') })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en#Advantages$/);
    await expectLandingLanguage(page, 'en', en);

    const logo: Locator = page.locator('header').getByRole('link', { name: en('header.logo_alt') });
    await expect(logo).toHaveAttribute('href', EN_LANDING);
  });

  test('keeps the drawer navigation inside the English page on a phone viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(EN_LANDING);

    await page.getByLabel(en('header.drawer.button_aria_labels.bars')).click();
    await page.getByRole('link', { name: en('header.contacts') }).click();
    await expect(page).toHaveURL(/\/en#Contacts$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('the root landing is still Ukrainian and alternates back to /en', async ({ page }) => {
    await page.goto(UK_LANDING);

    await expectLandingLanguage(page, 'uk', uk);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      absoluteUrl('/en')
    );
  });

  test('the English API stub sends its logo back to the English landing', async ({ page }) => {
    await page.goto('/en/docs/api');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const logo: Locator = page.locator('header').getByRole('link', { name: en('header.logo_alt') });
    await expect(logo).toHaveAttribute('href', EN_LANDING);
  });
});
