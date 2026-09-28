import { render } from '@testing-library/react';
import i18n, { t } from 'i18next';
import React from 'react';
import { I18nextProvider } from 'react-i18next';

import { EN_LOCALE } from '@/config/locales';

import ForWhoSection from '../../features/landing/components/for-who-section/for-who-section';
import {
  ProductScreenshots,
  productScreenshotsFor,
} from '../../features/landing/helpers/productScreenshots';

type ScreenshotsModule = typeof import('../../features/landing/helpers/productScreenshots');

// Same device as MainImage.test.tsx: every image import is one stub under Jest, so
// the mock names the language in the basename and the e2e spec proves the export.
jest.mock('../../features/landing/helpers/productScreenshots', () => {
  const actual: ScreenshotsModule = jest.requireActual(
    '../../features/landing/helpers/productScreenshots'
  );
  return { ...actual, productScreenshotsFor: jest.fn(actual.productScreenshotsFor) };
});

const actualScreenshots: ScreenshotsModule = jest.requireActual(
  '../../features/landing/helpers/productScreenshots'
);
const screenshotsFor: jest.MockedFunction<typeof productScreenshotsFor> =
  productScreenshotsFor as jest.MockedFunction<typeof productScreenshotsFor>;

const forWhoButton: string = t('for_who.button_text');

// Two product screens, nine shapes, and the diamond bullet the two card lists
// render twice each: every image in the section is decorative (issue #479).
const DECORATIVE_IMAGE_COUNT: number = 15;

function fakeSet(language: string): ProductScreenshots {
  return {
    desktop: { src: `/desktop-${language}.jpg`, width: 2037, height: 1494 },
    tablet: { src: `/tablet-${language}.jpg`, width: 922, height: 1229 },
    mobile: { src: `/mobile-${language}.jpg`, width: 539, height: 792 },
  };
}

function screensOf(container: HTMLElement, language: string): HTMLImageElement[] {
  return Array.from(
    container.querySelectorAll<HTMLImageElement>(
      `img[src*="desktop-${language}"], img[src*="mobile-${language}"]`
    )
  );
}

describe('ForWhoSection component', () => {
  afterEach(() => {
    screenshotsFor.mockClear();
    screenshotsFor.mockImplementation(actualScreenshots.productScreenshotsFor);
  });

  it('should render sign up links without nested button semantics', () => {
    const { getAllByText, queryAllByRole } = render(React.createElement(ForWhoSection));

    expect(getAllByText(forWhoButton)).toHaveLength(3);
    getAllByText(forWhoButton).forEach(element => {
      expect(element.closest('a')).toHaveAttribute('href', '#signUp');
    });
    expect(queryAllByRole('button', { name: forWhoButton })).toHaveLength(0);
  });

  it('renders every image as decorative, hidden from assistive technology', () => {
    // The hero `<picture>` on the same page already describes the product, so the
    // two screens repeated here would only be read twice; the old alts also
    // misdescribed them ("blue background", "minimal content") — WCAG 1.1.1, #479.
    const { container, getAllByAltText, queryAllByRole } = render(
      React.createElement(ForWhoSection)
    );

    expect(container.querySelectorAll('img')).toHaveLength(DECORATIVE_IMAGE_COUNT);
    expect(getAllByAltText('')).toHaveLength(DECORATIVE_IMAGE_COUNT);
    container.querySelectorAll('img').forEach(image => {
      expect(image).toHaveAttribute('aria-hidden', 'true');
    });
    expect(queryAllByRole('img')).toHaveLength(0);
  });

  it('shows the English screens under the English provider', () => {
    screenshotsFor.mockImplementation(fakeSet);

    const { container } = render(
      <I18nextProvider i18n={i18n.cloneInstance({ lng: EN_LOCALE })}>
        <ForWhoSection />
      </I18nextProvider>
    );

    expect(screenshotsFor).toHaveBeenCalledWith(EN_LOCALE);
    const [desktop, mobile] = screensOf(container, EN_LOCALE);
    expect(desktop).toHaveAttribute('src', expect.stringContaining('desktop-en'));
    expect(mobile).toHaveAttribute('src', expect.stringContaining('mobile-en'));
    expect(screensOf(container, i18n.language)).toHaveLength(0);
  });

  it('shows the screens of the ambient language by default', () => {
    screenshotsFor.mockImplementation(fakeSet);

    const { container } = render(React.createElement(ForWhoSection));

    expect(screenshotsFor).toHaveBeenCalledWith(i18n.language);
    const [desktop, mobile] = screensOf(container, i18n.language);
    expect(desktop).toHaveAttribute('src', expect.stringContaining(`desktop-${i18n.language}`));
    expect(mobile).toHaveAttribute('src', expect.stringContaining(`mobile-${i18n.language}`));
  });
});
