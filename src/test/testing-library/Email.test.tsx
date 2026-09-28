import { render } from '@testing-library/react';

import VilnaCRMEmail from '@landing/header/drawer/vilna-crm-email/vilna-crm-email';

import { mockEmail } from './constants';

const atSymbol: string = '@';

describe('VilnaCRMEmail component', () => {
  it('renders email address correctly', () => {
    const { getByText } = render(<VilnaCRMEmail />);

    const emailLink: HTMLElement = getByText(mockEmail);

    expect(emailLink).toBeInTheDocument();
  });

  it('renders "@" symbol correctly', () => {
    const { getByText } = render(<VilnaCRMEmail />);

    expect(getByText(atSymbol)).toBeInTheDocument();
  });

  it('keeps the decorative "@" glyph out of the link accessible name', () => {
    const { getByRole, getByText } = render(<VilnaCRMEmail />);

    // The glyph is visual only: the link is named by the address alone (#435).
    expect(getByRole('link', { name: mockEmail })).toHaveAttribute('href', `mailto:${mockEmail}`);
    expect(getByText(atSymbol)).toHaveAttribute('aria-hidden', 'true');
  });
});
