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

// Screenshots are language-baked rasters matched by filename; the for-who set
// is decorative (`alt=""`, #479), so it's located by src, not accessible name.
async function expectProductScreenshots(page: Page, t: FixedT, language: string): Promise<void> {
  const hero: Locator = page.getByRole('img', { name: t('about_vilna.image_alt') });
  await expect(hero).toHaveAttribute('src', new RegExp(`desktop-${language}\\.`));

  const sources: Locator = page.locator('picture source');
  await expect(sources).toHaveCount(2);
  await expect(sources.nth(0)).toHaveAttribute('srcset', new RegExp(`mobile-${language}\\.`));
  await expect(sources.nth(1)).toHaveAttribute('srcset', new RegExp(`tablet-${language}\\.`));

  const forWho: Locator = page.locator('#forWhoSection');
  await expect(forWho.locator(`img[src*="desktop-${language}."]`)).toHaveCount(1);
  await expect(forWho.locator(`img[src*="mobile-${language}."]`)).toHaveCount(1);
}

type LabelInset = {
  left: number;
  right: number;
  contained: boolean;
};

// Measured from text nodes, not a whole-element Range: MUI's ripple overlay
// spans the padding box, so a contents-wide range would flatten any label's
// inset to 0 once interacted with, making the centring assertion vacuous.
async function measureLabelInset(link: Locator): Promise<LabelInset> {
  return link.evaluate((element: HTMLElement) => {
    const box: DOMRect = element.getBoundingClientRect();
    const walker: TreeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const rects: DOMRect[] = [];

    for (let node: Node | null = walker.nextNode(); node; node = walker.nextNode()) {
      const range: Range = document.createRange();
      range.selectNodeContents(node);
      rects.push(range.getBoundingClientRect());
    }

    const painted: DOMRect[] = rects.filter(rect => rect.width > 0 && rect.height > 0);
    const left: number = Math.min(...painted.map(rect => rect.left));
    const right: number = Math.max(...painted.map(rect => rect.right));
    const top: number = Math.min(...painted.map(rect => rect.top));
    const bottom: number = Math.max(...painted.map(rect => rect.bottom));

    return {
      left: left - box.left,
      right: box.right - right,
      contained: left >= box.left && right <= box.right && top >= box.top && bottom <= box.bottom,
    };
  });
}

test.describe('English landing at /en', () => {
  test('renders the whole page in English, with an English document language', async ({ page }) => {
    await page.goto(EN_LANDING);

    await expectLandingLanguage(page, 'en', en);
    await expect(page.getByText(uk('about_vilna.heading_first_main'))).toHaveCount(0);
  });

  test('shows the English product screenshots, never the Ukrainian renders', async ({ page }) => {
    await page.goto(EN_LANDING);

    await expectProductScreenshots(page, en, 'en');
    await expect(page.locator('img[src*="desktop-uk."], source[srcset*="-uk."]')).toHaveCount(0);
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
    await expectProductScreenshots(page, uk, 'uk');
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      absoluteUrl('/en')
    );
  });

  // Below 968px this flex item blockifies and drops MUI's inline-flex
  // centring, so the label sat flush left (English only; Ukrainian text fills
  // the pill).
  //
  // Positive: label centred and contained in the link box.
  // Negative / regression: red on main, green after the inline-flex fix.
  // Boundary: only rendered under the 968px query; above it this CTA is hidden.
  // Permission / auth — Not applicable: static marketing CTA.
  test('centres the for-who call-to-action label on a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(EN_LANDING);

    // Scoped to `#forWhoSection`: the header has an identical link, and only
    // the small-screen copy is in the tree below 968px, so this matches exactly one.
    const cta: Locator = page
      .locator('#forWhoSection')
      .getByRole('link', { name: en('for_who.button_text'), exact: true });

    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '#signUp');
    await expect(cta).toHaveAccessibleName(en('for_who.button_text'));

    const inset: LabelInset = await measureLabelInset(cta);

    expect(inset.contained).toBe(true);
    expect(Math.abs(inset.left - inset.right)).toBeLessThanOrEqual(1);

    // Asserted last: a focus-visible ripple would corrupt the measurement above.
    await cta.focus();
    await expect(cta).toBeFocused();
  });

  test('the English API docs page sends its logo back to the English landing', async ({ page }) => {
    await page.goto('/en/docs/api');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const logo: Locator = page.locator('header').getByRole('link', { name: en('header.logo_alt') });
    await expect(logo).toHaveAttribute('href', EN_LANDING);
  });
});
