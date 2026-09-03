// Lives under src/test/e2e/mobile because these are properties of the *device*,
// not of the window size. `page.setViewportSize()` on a desktop project changes
// the window but leaves the layout viewport, the device pixel ratio and the
// touch capability untouched, so none of the assertions below would mean
// anything there — only `isMobile` makes the exported `<meta name="viewport">`
// take effect at all.
import { test, expect, Locator, Page } from '@playwright/test';

// Pixel 7's CSS viewport and pixel ratio, spelled out on purpose: the assertion
// is that the page adopts the *device* metrics, so reading the expectation back
// out of the same browser would assert nothing. Keep in sync with the
// `devices['Pixel 7']` descriptor in playwright.config.ts.
const DEVICE_VIEWPORT_WIDTH: number = 412;
const DEVICE_PIXEL_RATIO: number = 2.625;

// The picture element is keyed on the viewport, and its `alt` is a literal that
// the component passes through `t()` with no matching key, so it renders
// verbatim — it is an identifier here, not localized copy.
const MAIN_IMAGE_ALT: string = 'Main image';

type DeviceMetrics = {
  innerWidth: number;
  devicePixelRatio: number;
  maxTouchPoints: number;
};

type ViewportFit = {
  scrollWidth: number;
  innerWidth: number;
};

type PictureResolution = {
  currentSrc: string;
  sourceCount: number;
  mobileSrcSet: string;
  mobileMediaMatches: boolean;
  fallbackSrc: string;
};

async function measureViewportFit(page: Page): Promise<ViewportFit> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
}

test.describe('Mobile layout invariants', () => {
  test('the exported page adopts the device layout viewport', async ({ page }) => {
    await page.goto('/');

    // Without this tag Chromium would lay the page out at its 980px fallback
    // width and then scale it down, which is exactly the failure the width
    // assertion below is guarding.
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      /width=device-width/
    );

    const metrics: DeviceMetrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      devicePixelRatio: window.devicePixelRatio,
      maxTouchPoints: navigator.maxTouchPoints,
    }));

    expect(metrics.innerWidth).toBe(DEVICE_VIEWPORT_WIDTH);
    expect(metrics.devicePixelRatio).toBe(DEVICE_PIXEL_RATIO);
    expect(metrics.maxTouchPoints).toBeGreaterThan(0);
  });

  test('the landing page fits the device width with no sideways scrolling', async ({ page }) => {
    await page.goto('/');
    // Every landing section is a `ssr: false` dynamic import, so the document is
    // still growing right after load; measuring then would measure half a page.
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('main')).toBeVisible();

    const fit: ViewportFit = await measureViewportFit(page);

    expect(fit.scrollWidth).toBeLessThanOrEqual(fit.innerWidth);
  });

  test('the swagger page fits the device width with no sideways scrolling', async ({ page }) => {
    await page.goto('/swagger', { waitUntil: 'domcontentloaded' });
    // Swagger UI is third-party markup behind a `ssr: false` dynamic import and
    // has no stable role of its own, so its own root class is the anchor.
    await expect(page.locator('.swagger-ui')).toBeVisible({ timeout: 15000 });
    await page.waitForLoadState('networkidle');

    const fit: ViewportFit = await measureViewportFit(page);

    expect(fit.scrollWidth).toBeLessThanOrEqual(fit.innerWidth);
  });

  test('the responsive picture resolves to its mobile source', async ({ page }) => {
    await page.goto('/');

    const mainImage: Locator = page.getByRole('img', { name: MAIN_IMAGE_ALT });
    await expect(mainImage).toBeVisible({ timeout: 15000 });
    // `currentSrc` stays empty until the browser has picked a candidate, which
    // can lag first paint, so poll instead of reading it once.
    await expect
      .poll(async () => mainImage.evaluate((img: HTMLImageElement) => img.currentSrc))
      .not.toBe('');

    const resolution: PictureResolution = await mainImage.evaluate((img: HTMLImageElement) => {
      const sources: HTMLSourceElement[] = Array.from(
        img.closest('picture')?.querySelectorAll('source') ?? []
      );
      const [mobileSource] = sources;

      return {
        currentSrc: img.currentSrc,
        sourceCount: sources.length,
        mobileSrcSet: mobileSource?.srcset ?? '',
        mobileMediaMatches: window.matchMedia(mobileSource?.media ?? 'not all').matches,
        fallbackSrc: img.getAttribute('src') ?? '',
      };
    });

    // The narrowest `<source>` is declared first, so at a 412px device width the
    // browser must stop there rather than fall through to the desktop `<img>`.
    expect(resolution.sourceCount).toBe(2);
    expect(resolution.mobileMediaMatches).toBe(true);
    // Guarded so the `toContain` below cannot pass against an empty needle.
    expect(resolution.mobileSrcSet).not.toBe('');
    expect(resolution.currentSrc).toContain(resolution.mobileSrcSet);
    expect(resolution.currentSrc).not.toContain(resolution.fallbackSrc);
  });
});
