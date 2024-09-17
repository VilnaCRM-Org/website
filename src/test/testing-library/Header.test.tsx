import { render } from '@testing-library/react';
import i18next, { t } from 'i18next';

import Header from '../../features/landing/components/Header/Header';

const logoAlt: string = t('header.logo_alt');

describe('Header component', () => {
  it('renders logo', () => {
    const { getByAltText } = render(<Header />);
    expect(getByAltText(logoAlt)).toBeInTheDocument();
  });

  it('uses correct translation key for logo alt text', () => {
    const spy: jest.SpyInstance = jest.spyOn(i18next, 't');
    render(<Header />);
    expect(spy).toHaveBeenCalledWith('header.logo_alt', {
      keyPrefix: undefined,
      lng: undefined,
      lngs: null,
      ns: 'translation',
    });
    spy.mockRestore();
  });
});
