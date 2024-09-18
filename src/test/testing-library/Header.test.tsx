import { render } from '@testing-library/react';
import i18next from 'i18next';

import Header from '../../features/landing/components/Header/Header';

const logoAltKey: string = 'header.logo_alt';
const logoAlt: string = i18next.t(logoAltKey);

describe('Header component', () => {
  let spy: jest.SpyInstance;

  afterEach(() => {
    if (spy) {
      spy.mockRestore();
    }
  });

  it('uses correct translation key for logo alt text', () => {
    spy = jest.spyOn(i18next, 't');
    render(<Header />);
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls).toContainEqual([logoAltKey, expect.anything()]);
  });

  it('renders logo', () => {
    const { getByAltText } = render(<Header />);
    expect(getByAltText(logoAlt)).toBeInTheDocument();
  });
});
