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

function fakeSet(language: string): ProductScreenshots {
  return {
    desktop: { src: `/desktop-${language}.jpg`, width: 2037, height: 1494 },
    tablet: { src: `/tablet-${language}.jpg`, width: 922, height: 1229 },
    mobile: { src: `/mobile-${language}.jpg`, width: 539, height: 792 },
  };
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

  it('should have the correct number of images with empty alt text and images with proper alt text', () => {
    const { getAllByAltText } = render(React.createElement(ForWhoSection));

    const imagesWithEmptyAlt: HTMLElement[] = getAllByAltText('');
    expect(imagesWithEmptyAlt).toHaveLength(9);

    const imagesWithAltText: HTMLElement[] = getAllByAltText('Vector');
    expect(imagesWithAltText).toHaveLength(4);
  });

  it('names the two product screenshots from the bundle, never from a raw key', () => {
    // The screens used to read `t('alts.big_screen')`, a key no bundle declares, so
    // i18next returned the key itself and screen readers voiced "alts dot big screen".
    const { getByAltText, queryByAltText } = render(React.createElement(ForWhoSection));

    expect(getByAltText(t('for_who.image_alt.big_screen'))).toBeInTheDocument();
    expect(getByAltText(t('for_who.image_alt.small_screen'))).toBeInTheDocument();
    expect(queryByAltText(/^alts\./)).not.toBeInTheDocument();
    expect(t('for_who.image_alt.big_screen')).not.toMatch(/^for_who\./);
  });

  it('shows the English screens under the English provider, with English alts', () => {
    screenshotsFor.mockImplementation(fakeSet);
    const en: (key: string) => string = i18n.getFixedT(EN_LOCALE);

    const { getByAltText } = render(
      <I18nextProvider i18n={i18n.cloneInstance({ lng: EN_LOCALE })}>
        <ForWhoSection />
      </I18nextProvider>
    );

    expect(screenshotsFor).toHaveBeenCalledWith(EN_LOCALE);
    expect(getByAltText(en('for_who.image_alt.big_screen'))).toHaveAttribute(
      'src',
      expect.stringContaining('desktop-en')
    );
    expect(getByAltText(en('for_who.image_alt.small_screen'))).toHaveAttribute(
      'src',
      expect.stringContaining('mobile-en')
    );
  });

  it('shows the screens of the ambient language by default', () => {
    screenshotsFor.mockImplementation(fakeSet);

    const { getByAltText } = render(React.createElement(ForWhoSection));

    expect(screenshotsFor).toHaveBeenCalledWith(i18n.language);
    expect(getByAltText(t('for_who.image_alt.big_screen'))).toHaveAttribute(
      'src',
      expect.stringContaining(`desktop-${i18n.language}`)
    );
    expect(getByAltText(t('for_who.image_alt.small_screen'))).toHaveAttribute(
      'src',
      expect.stringContaining(`mobile-${i18n.language}`)
    );
  });
});
