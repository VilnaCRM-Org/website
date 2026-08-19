// Lives under src/test/e2e/mobile because the advantages carousel only exists on
// a touch device: below the `sm` breakpoint the card grid is swapped for a Swiper
// carousel, and the gesture that drives it has to arrive as touch input. A
// desktop project narrowed to 412px would render the carousel but could only
// drag it with a mouse, which is a different code path in Swiper.
import { test, expect, CDPSession, Locator, Page } from '@playwright/test';

import { t } from '../utils/initializeLocalization';
import { removeHtmlTags } from '../utils/removeHtmlTags';

const firstCardTitle: string = t('why_us.headers.header_open_source');
// The localized title carries a `<br />`, which the accessible name flattens.
const secondCardTitle: string = removeHtmlTags('why_us.headers.header_ease_of_setup');

// Fraction of the carousel width the finger travels. Swiper advances on a long
// swipe past half a slide, so 0.6 clears the threshold from either edge while
// keeping both ends of the gesture inside the carousel.
const SWIPE_TRAVEL_RATIO: number = 0.6;

type SwipeDirection = -1 | 1;
type TouchPoint = { x: number; y: number };

function advantagesSection(page: Page): Locator {
  return page.locator('section#Advantages');
}

function carousel(page: Page): Locator {
  return advantagesSection(page).locator('.swiper');
}

function activeSlide(page: Page): Locator {
  return advantagesSection(page).locator('.swiper-slide-active');
}

// Playwright's touchscreen API only exposes `tap()`, so a finger *drag* has to be
// fed to Chromium as raw touch input over CDP — one more reason this project
// cannot be Firefox. Swiper reads the movement to decide whether a gesture is a
// swipe at all, so the drag is emitted as several moves rather than one jump.
async function dispatchTouchDrag(page: Page, start: TouchPoint, distance: number): Promise<void> {
  const session: CDPSession = await page.context().newCDPSession(page);

  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: start.x + distance * 0.25, y: start.y }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: start.x + distance * 0.6, y: start.y }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: start.x + distance, y: start.y }],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await session.detach();
}

async function swipeCarousel(page: Page, direction: SwipeDirection): Promise<void> {
  const track: Locator = carousel(page);
  await track.scrollIntoViewIfNeeded();

  // CDP touch coordinates are viewport coordinates, so the box has to be read
  // after the scroll above rather than from a cached measurement.
  const box: { x: number; y: number; width: number; height: number } | null =
    await track.boundingBox();
  if (box === null) {
    throw new Error('The advantages carousel has no layout box, so it cannot be swiped.');
  }

  const travel: number = box.width * SWIPE_TRAVEL_RATIO * direction;
  const startRatio: number = direction < 0 ? 0.8 : 0.2;

  await dispatchTouchDrag(
    page,
    { x: box.x + box.width * startRatio, y: box.y + box.height / 2 },
    travel
  );
}

test.describe('Advantages carousel on a touch device', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(carousel(page)).toBeVisible({ timeout: 15000 });
  });

  test('the carousel, not the desktop grid, is what a touch device queries', async ({ page }) => {
    const section: Locator = advantagesSection(page);

    // Both layouts are always rendered and one is hidden with CSS, so the card
    // title exists twice in the DOM but only once in the accessibility tree —
    // which is why every assertion below addresses the carousel copy and never
    // silently passes against the grid.
    await expect(
      section.getByRole('heading', { name: firstCardTitle, includeHidden: true })
    ).toHaveCount(2);
    await expect(section.getByRole('heading', { name: firstCardTitle })).toHaveCount(1);
    await expect(carousel(page).getByRole('heading', { name: firstCardTitle })).toBeVisible();
  });

  test('a horizontal swipe advances the carousel to the next card', async ({ page }) => {
    await expect(activeSlide(page).getByRole('heading', { name: firstCardTitle })).toBeVisible();

    await swipeCarousel(page, -1);

    await expect(activeSlide(page).getByRole('heading', { name: secondCardTitle })).toBeVisible();
    await expect(activeSlide(page).getByRole('heading', { name: firstCardTitle })).toBeHidden();
  });

  test('swiping back returns the carousel to the previous card', async ({ page }) => {
    await swipeCarousel(page, -1);
    await expect(activeSlide(page).getByRole('heading', { name: secondCardTitle })).toBeVisible();

    await swipeCarousel(page, 1);

    await expect(activeSlide(page).getByRole('heading', { name: firstCardTitle })).toBeVisible();
  });
});
