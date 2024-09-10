import { test, Locator, expect, Page } from '@playwright/test';

import { t } from './utils/initializeLocalization';

const FIRST_SLIDE_TITLE_WHY_US: string = t('why_us.headers.header_open_source');
const SECOND_SLIDE_TITLE_WHY_US: string = t('why_us.headers.header_ease_of_setup').replace(
  '<br /> ',
  ''
);
const FIRST_SLIDE_TITLE_POSSIBILITIES: string = t(
  'unlimited_possibilities.cards_headings.heading_public_api'
);
const PUBLIC_LIBRARIES: RegExp = new RegExp(
  t('unlimited_possibilities.cards_headings.heading_libraries').split(' <br />').join('')
);

async function performSliderTest(
  page: Page,
  firstSlideLocator: Locator,
  secondSlideLocator: Locator
): Promise<void> {
  await page.goto('/');
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
      name: FIRST_SLIDE_TITLE_WHY_US,
      exact: true,
    });
    const secondSlideWhyUs: Locator = page.getByRole('heading', {
      name: SECOND_SLIDE_TITLE_WHY_US,
    });

    await performSliderTest(page, firstSlideWhyUs, secondSlideWhyUs);
  });

  test('Slider test in the possibilities section', async ({ page }) => {
    const firstSlidePossibilities: Locator = page.getByRole('heading', {
      name: FIRST_SLIDE_TITLE_POSSIBILITIES,
    });
    const secondSlidePossibilities: Locator = page.getByRole('heading', {
      name: PUBLIC_LIBRARIES,
    });

    await performSliderTest(page, firstSlidePossibilities, secondSlidePossibilities);

    await expect(secondSlidePossibilities).toBeVisible();
  });
});
