import { DEFAULT_LOCALE, EN_LOCALE } from '@/config/locales';

import {
  EN_SCREENSHOTS,
  productScreenshotsFor,
  UK_SCREENSHOTS,
} from '../../features/landing/helpers/productScreenshots';

// The landing renders the product screenshots (hero `<picture>` and the for-who
// screens) from a per-language set, so the English landing at `/en` never shows
// the Ukrainian dashboard. Jest maps every image import to one shared stub, so
// the sets are told apart by identity here; the e2e spec `en-landing.spec.ts`
// proves which file each set actually resolves to in the export.
describe('productScreenshotsFor', () => {
  it('serves the English set for the English locale and its regional variants', () => {
    expect(productScreenshotsFor(EN_LOCALE)).toBe(EN_SCREENSHOTS);
    expect(productScreenshotsFor('en-GB')).toBe(EN_SCREENSHOTS);
  });

  it('serves the Ukrainian set for the default locale', () => {
    expect(productScreenshotsFor(DEFAULT_LOCALE)).toBe(UK_SCREENSHOTS);
    expect(productScreenshotsFor('uk')).toBe(UK_SCREENSHOTS);
  });

  it('falls back to the Ukrainian set for a language with no renders', () => {
    // Boundary: an unknown tag, a tag that merely starts with "en" and an empty
    // string all fall through to the set the site was designed around.
    expect(productScreenshotsFor('de')).toBe(UK_SCREENSHOTS);
    expect(productScreenshotsFor('eng')).toBe(UK_SCREENSHOTS);
    expect(productScreenshotsFor('')).toBe(UK_SCREENSHOTS);
  });

  it('exposes every breakpoint render in both sets', () => {
    // Not applicable — loading / error: a synchronous lookup over bundled assets.
    [EN_SCREENSHOTS, UK_SCREENSHOTS].forEach(set => {
      expect(set.desktop).toBeDefined();
      expect(set.tablet).toBeDefined();
      expect(set.mobile).toBeDefined();
    });
    expect(EN_SCREENSHOTS).not.toBe(UK_SCREENSHOTS);
  });
});
