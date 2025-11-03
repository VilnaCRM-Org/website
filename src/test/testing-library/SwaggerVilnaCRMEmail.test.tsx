import { render } from '@testing-library/react';

import VilnaCRMEmail from '../../features/swagger/components/Header/Drawer/VilnaCRMEmail/VilnaCRMEmail';

const emailAddress: string = process.env.NEXT_PUBLIC_VILNACRM_GMAIL ?? 'info@vilnacrm.com';
const mailtoHref: string = `mailto:${emailAddress}`;

describe('Swagger VilnaCRMEmail component', () => {
  it('renders the configured email address', () => {
    const { getByText } = render(<VilnaCRMEmail />);

    expect(getByText(emailAddress)).toBeInTheDocument();
  });

  it('links to the email address via mailto', () => {
    const { getByRole } = render(<VilnaCRMEmail />);

    expect(getByRole('link', { name: new RegExp(emailAddress, 'i') })).toHaveAttribute(
      'href',
      mailtoHref
    );
  });
});
