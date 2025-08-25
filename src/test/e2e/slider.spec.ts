import { test, Locator, expect, Page } from '@playwright/test';

import  createLocalizedRegExp  from '@/test/e2e/utils/createLocalizedRegExp';

import { t } from './utils/initializeLocalization';
import  removeHtmlTags  from './utils/removeHtmlTags';

const firstSlideTitleWhyUs: string = t('why_us.headers.header_open_source');
const secondSlideTitleWhyUs: string = removeHtmlTags('why_us.headers.header_ease_of_setup');
const firstSlideTitlePossibilities: string = t(
  'unlimited_possibilities.cards_headings.heading_public_api'
);
const publicLibrariesTextWithoutTags: string = removeHtmlTags(
  'unlimited_possibilities.cards_headings.heading_libraries'
);
const publicLibraries: RegExp = createLocalizedRegExp(publicLibrariesTextWithoutTags);

async function performSliderTest(
  page: Page,
  firstSlideLocator: Locator,
  secondSlideLocator: Locator
): Promise<void> {
  await page.goto('/', { waitUntil: 'load', timeout: 30000 });
  await page.setViewportSize({ width: 375, height: 812 });

  const sliderOffsetWidth: number = await firstSlideLocator.evaluate(
    el => el.getBoundingClientRect().width + 220
  );

  await firstSlideLocator.hover({ force: true, position: { x: 0, y: 0 } });
  await page.mouse.down();
  await firstSlideLocator.hover({
    force: true,
    position: { x: sliderOffsetWidth, y: 0 },
  });
  await page.mouse.up();

  await expect(secondSlideLocator).toBeVisible();
}

test.describe('Slider tests', () => {
  test('Slider test in the whyus section', async ({ page }) => {
    const firstSlideWhyUs: Locator = page.getByRole('heading', {
      name: firstSlideTitleWhyUs,
      exact: true,
    });
    const secondSlideWhyUs: Locator = page.getByRole('heading', {
      name: secondSlideTitleWhyUs,
    });

    await performSliderTest(page, firstSlideWhyUs, secondSlideWhyUs);
  });

  test('Slider test in the possibilities section', async ({ page }) => {
    const firstSlidePossibilities: Locator = page.getByRole('heading', {
      name: firstSlideTitlePossibilities,
    });
    const secondSlidePossibilities: Locator = page.getByRole('heading', {
      name: publicLibraries,
    });

    await performSliderTest(page, firstSlidePossibilities, secondSlidePossibilities);

    await expect(secondSlidePossibilities).toBeVisible();
  });
});
