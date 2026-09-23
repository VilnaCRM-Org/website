import { expect, Locator, Page, Response, test } from '@playwright/test';
import i18n from 'i18next';

import { DEFAULT_LOCALE } from '@/config/locales';


import './utils/initializeLocalization';

type FixedT = (key: string) => string;

// Both e2e stacks serve the export with `serve`, which answers an unmatched path with
// `out/404.html` and a real 404 status. Paths stay outside `/en`: the 404 document is
// exported once, from the `/404` pathname, so it always renders in the main language.
const UNKNOWN_PATH: string = '/this-page-does-not-exist';
const UNKNOWN_NESTED_PATH: string = '/no/such/nested/page';

const t: FixedT = i18n.getFixedT(DEFAULT_LOCALE);

async function openUnknownPath(page: Page, path: string): Promise<void> {
  const response: Response | null = await page.goto(path);

  expect(response?.status()).toBe(404);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

async function expectBrandedNotFound(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', DEFAULT_LOCALE);
  await expect(page).toHaveTitle(t('not_found.title'));

  const main: Locator = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: t('not_found.heading') })).toBeVisible();
  await expect(main.getByText(t('not_found.hint'))).toBeVisible();
  await expect(main.getByRole('link', { name: t('not_found.home_link') })).toHaveAttribute(
    'href',
    '/'
  );
}

test.describe('Not-found page', () => {
  test('serves the localized, branded 404 document with a 404 status for an unknown path', async ({
    page,
  }) => {
    await openUnknownPath(page, UNKNOWN_PATH);

    await expectBrandedNotFound(page);
  });

  test('serves the same 404 document for an unknown nested path', async ({ page }) => {
    await openUnknownPath(page, UNKNOWN_NESTED_PATH);

    await expectBrandedNotFound(page);
  });

  test('takes the visitor back to the home page from the 404 link', async ({ page }) => {
    await openUnknownPath(page, UNKNOWN_PATH);

    await page.getByRole('link', { name: t('not_found.home_link') }).click();

    await expect(page).toHaveURL(url => url.pathname === '/');
    await expect(page.locator('html')).toHaveAttribute('lang', DEFAULT_LOCALE);
    await expect(page).toHaveTitle(t('seo.landing.title'));
  });
});
