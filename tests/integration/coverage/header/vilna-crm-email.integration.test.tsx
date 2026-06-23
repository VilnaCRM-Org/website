import { render } from '@testing-library/react';

import VilnaCRMEmail from '@components/Header/Drawer/VilnaCRMEmail/VilnaCRMEmail';

const mockEmail: string = 'info@vilnacrm.com';
const atSymbol: string = '@';

describe('integration: VilnaCRMEmail', () => {
  it('renders the email address', () => {
    const { getByText } = render(<VilnaCRMEmail />);

    expect(getByText(mockEmail)).toBeInTheDocument();
  });

  it('renders the "@" symbol', () => {
    const { getByText } = render(<VilnaCRMEmail />);

    expect(getByText(atSymbol)).toBeInTheDocument();
  });

  it('links to the mailto address', () => {
    const { getByRole } = render(<VilnaCRMEmail />);

    expect(getByRole('link')).toHaveAttribute('href', 'mailto:info@vilnacrm.com');
  });
});
