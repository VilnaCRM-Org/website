/**
 * Integration coverage for the per-language product screenshots.
 *
 * The hero `<picture>` and the for-who screens read their sources from
 * `productScreenshotsFor(i18n.language)`, so the English landing at `/en` never
 * shows the Ukrainian dashboard. This layer renders the REAL components under
 * an English i18next clone — the same shape `useRouteI18n` hands `_app` — so
 * the English branch of the helper is executed end to end rather than only
 * through a mocked set. Under Jest every image import is one shared stub, so
 * the sets are told apart by identity; `en-landing.spec.ts` pins the exported
 * basenames.
 */
import { render } from '@testing-library/react';
import i18n from 'i18next';
import { I18nextProvider } from 'react-i18next';

import { EN_LOCALE } from '@/config/locales';
import MainImage from '@landing/about-us/main-image/main-image';
import ForWhoSection from '@landing/for-who-section/for-who-section';

import {
  EN_SCREENSHOTS,
  productScreenshotsFor,
  UK_SCREENSHOTS,
} from '../../../../src/features/landing/helpers/productScreenshots';

const englishAlt: (key: string) => string = i18n.getFixedT(EN_LOCALE);

describe('integration: productScreenshotsFor', () => {
  it('serves the English set for English and its regional variants', () => {
    expect(productScreenshotsFor(EN_LOCALE)).toBe(EN_SCREENSHOTS);
    expect(productScreenshotsFor('en-GB')).toBe(EN_SCREENSHOTS);
  });

  it('falls back to the Ukrainian set for every other tag', () => {
    expect(productScreenshotsFor(i18n.language)).toBe(UK_SCREENSHOTS);
    expect(productScreenshotsFor('eng')).toBe(UK_SCREENSHOTS);
    expect(productScreenshotsFor('')).toBe(UK_SCREENSHOTS);
  });

  it('exposes a frozen desktop/tablet/mobile triple per language', () => {
    [EN_SCREENSHOTS, UK_SCREENSHOTS].forEach(set => {
      expect(Object.isFrozen(set)).toBe(true);
      expect(set.desktop).toBeDefined();
      expect(set.tablet).toBeDefined();
      expect(set.mobile).toBeDefined();
    });
  });

  it('renders the hero picture and the for-who screens under an English provider', () => {
    const english: typeof i18n = i18n.cloneInstance({ lng: EN_LOCALE });

    const { container, getByAltText } = render(
      <I18nextProvider i18n={english}>
        <MainImage />
        <ForWhoSection />
      </I18nextProvider>
    );

    expect(getByAltText('Main image')).toHaveAttribute('src');
    expect(container.querySelectorAll('picture source')).toHaveLength(2);
    expect(getByAltText(englishAlt('for_who.image_alt.big_screen'))).toHaveAttribute('src');
    expect(getByAltText(englishAlt('for_who.image_alt.small_screen'))).toHaveAttribute('src');
  });
});
