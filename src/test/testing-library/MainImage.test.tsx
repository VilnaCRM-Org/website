import { render } from '@testing-library/react';
import i18n, { t } from 'i18next';
import { I18nextProvider } from 'react-i18next';

import { EN_LOCALE } from '@/config/locales';

import MainImage from '../../features/landing/components/about-us/main-image/main-image';
import {
  ProductScreenshots,
  productScreenshotsFor,
} from '../../features/landing/helpers/productScreenshots';

type ScreenshotsModule = typeof import('../../features/landing/helpers/productScreenshots');

// Jest maps every image import to one shared stub, so the language-specific sets
// are indistinguishable by `src` here. The mock can hand the component sources
// whose basenames name the language, which is exactly the contract the e2e spec
// (`en-landing.spec.ts`) then proves against the real export. The real
// implementation stays in place unless a test swaps it in.
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

const mainImageAlt: string = t('about_vilna.image_alt');
const englishAlt: (key: string) => string = i18n.getFixedT(EN_LOCALE);

function fakeSet(language: string): ProductScreenshots {
  return {
    desktop: { src: `/desktop-${language}.jpg`, width: 2037, height: 1494 },
    tablet: { src: `/tablet-${language}.jpg`, width: 922, height: 1229 },
    mobile: { src: `/mobile-${language}.jpg`, width: 539, height: 792 },
  };
}

describe('MainImage component', () => {
  afterEach(() => {
    screenshotsFor.mockClear();
    screenshotsFor.mockImplementation(actualScreenshots.productScreenshotsFor);
  });

  it('renders the MainImage component with correct alt text', () => {
    const { container, getByAltText } = render(<MainImage />);

    const [smallMediaSource, largeMediaSource] = container.querySelectorAll('source');

    expect(getByAltText(mainImageAlt)).toBeInTheDocument();
    expect(smallMediaSource).toHaveAttribute('media', '(max-width: 640px)');
    expect(largeMediaSource).toHaveAttribute('media', '(max-width: 1024px)');
  });

  it('describes the product in the page language, never with a placeholder', () => {
    // The hero used to ship `alt="Main image"` — WCAG 1.1.1 failure F30 — passed
    // through `t()` with no key behind it, so every language heard the same two
    // English words (#479). One alt names the whole <picture>, so it describes
    // what every crop shows: the board with its task list open.
    const { getByRole, queryByAltText } = render(<MainImage />);

    expect(getByRole('img')).toHaveAccessibleName(mainImageAlt);
    expect(mainImageAlt).not.toMatch(/^about_vilna\./);
    expect(mainImageAlt).not.toBe('Main image');
    expect(queryByAltText('Main image')).not.toBeInTheDocument();
    expect(englishAlt('about_vilna.image_alt')).not.toBe(mainImageAlt);
  });

  it('serves the English renders when it is rendered under the English provider', () => {
    screenshotsFor.mockImplementation(fakeSet);

    const { container, getByAltText } = render(
      <I18nextProvider i18n={i18n.cloneInstance({ lng: EN_LOCALE })}>
        <MainImage />
      </I18nextProvider>
    );

    expect(screenshotsFor).toHaveBeenCalledWith(EN_LOCALE);
    expect(getByAltText(englishAlt('about_vilna.image_alt'))).toHaveAttribute(
      'src',
      expect.stringContaining('desktop-en')
    );
    const [phone, tablet] = container.querySelectorAll('source');
    expect(phone).toHaveAttribute('srcset', expect.stringContaining('mobile-en'));
    expect(tablet).toHaveAttribute('srcset', expect.stringContaining('tablet-en'));
  });

  it('serves the renders of the ambient language, Ukrainian by default', () => {
    screenshotsFor.mockImplementation(fakeSet);

    const { getByAltText } = render(<MainImage />);

    expect(screenshotsFor).toHaveBeenCalledWith(i18n.language);
    expect(getByAltText(mainImageAlt)).toHaveAttribute(
      'src',
      expect.stringContaining(`desktop-${i18n.language}`)
    );
  });

  it('keeps every breakpoint on the same language set', () => {
    // Boundary: a mixed set would show a Ukrainian phone frame on an English page
    // at one viewport only; the helper hands out one frozen triple per language.
    const set: ProductScreenshots = actualScreenshots.productScreenshotsFor(EN_LOCALE);

    expect(Object.isFrozen(set)).toBe(true);
    expect(set).toBe(actualScreenshots.productScreenshotsFor('en-GB'));
    expect(set).not.toBe(actualScreenshots.productScreenshotsFor(i18n.language));
  });
});
