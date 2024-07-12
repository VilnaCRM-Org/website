import { render } from '@testing-library/react';

import { createTranslation, TranslationFunctionType } from '@/test/translate';

import Header from '../../features/landing/components/Header/Header';

const t: TranslationFunctionType = createTranslation('pages/i18n');

const logoAlt: string = t('header.logo_alt');

describe('Header component', () => {
  it('renders logo', () => {
    const { getByAltText } = render(<Header />);
    expect(getByAltText(logoAlt)).toBeInTheDocument();
  });
});
