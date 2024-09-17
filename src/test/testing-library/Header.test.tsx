import { render } from '@testing-library/react';
import { t } from 'i18next';

import Header from '../../features/landing/components/Header/Header';

const logoAlt: string = t('header.logo_alt');

describe('Header component', () => {
  it('renders logo', () => {
    const { getByAltText } = render(<Header />);
    expect(getByAltText(logoAlt)).toBeInTheDocument();
  });
});
