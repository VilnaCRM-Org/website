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

// The product screenshots are rasters with copy baked in, so each landing has to
// serve the set rendered in its own language. The exported file keeps the source
// basename (`desktop-en.<hash>_<width>.webp`), which is what pins the set here.
// The for-who screens are decorative (`alt=""`, #479), so they are located by
// source rather than by an accessible name.
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

// The label is measured from the element's text nodes, never from a
// `range.selectNodeContents(link)` over the whole button: MUI's ButtonBase
// lazily mounts a `.MuiTouchRipple-root` span that is absolutely positioned
// over the entire padding box, and `Range.getClientRects()` includes element
// border boxes as well as text. Once any interaction has mounted that span, a
// contents-wide range reports left = right = 0 for a flush-left label just as
// readily as for a centred one, which would make the assertion below vacuous.
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

  // The for-who CTA pill is capped at `maxWidth: 8.563rem` and, below the
  // 968px breakpoint, was `display: inline-block`. As a flex item in the
  // cards' column Stack that blockifies to `block`, which discards MUI
  // ButtonBase's own `inline-flex` + `justify-content: center` and leaves the
  // label flush against the start padding edge. The Ukrainian "Спробувати"
  // happens to fill the pill, so only the English "Try it out" showed the gap.
  //
  // Scenario coverage
  // - Positive: the label is horizontally centred inside the pill and its
  //   glyph box is fully contained by the link box.
  // - Negative / regression: before the `display: inline-flex` fix Chromium
  //   measures left ≈ 24px against right ≈ 43px here, which fails the
  //   symmetry assertion — so this test is red on main and green after it.
  // - Boundary: this layout is selected by the `max-width: 968px` media query
  //   (375px is inside it), and it is the only range in which this CTA is
  //   rendered at all — above the breakpoint the cards' button is
  //   `display: none` and the main-title button takes over.
  // - Permission / auth — Not applicable: static marketing CTA.
  test('centres the for-who call-to-action label on a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(EN_LANDING);

    // `#forWhoSection` renders the cards twice and the header carries an
    // identical "Try it out" link. Below 968px only the small-screen copy is
    // in the accessibility tree, and the section scope excludes the header, so
    // this resolves to exactly one link.
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

    // Focus is asserted last on purpose: a focus-visible ButtonBase mounts the
    // ripple overlay the measurement above must never see.
    await cta.focus();
    await expect(cta).toBeFocused();
  });

  test('the English API stub sends its logo back to the English landing', async ({ page }) => {
    await page.goto('/en/docs/api');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const logo: Locator = page.locator('header').getByRole('link', { name: en('header.logo_alt') });
    await expect(logo).toHaveAttribute('href', EN_LANDING);
  });
});
