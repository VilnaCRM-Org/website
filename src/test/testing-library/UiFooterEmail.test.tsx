import { render } from '@testing-library/react';

import { VilnaCRMEmail } from '@/components/ui-footer/vilna-crm-email';

import { mockEmail } from './constants';

describe('VilnaCRMEmail component', () => {
  it('renders email address correctly', () => {
    const { getByText } = render(<VilnaCRMEmail />);

    const emailLink: HTMLElement = getByText(mockEmail);
    expect(emailLink).toBeInTheDocument();
  });
});
