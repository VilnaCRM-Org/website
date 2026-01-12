import { render } from '@testing-library/react';

import VilnaCRMEmail from '../../features/swagger/components/Header/Drawer/VilnaCRMEmail/VilnaCRMEmail';

import { mockEmail } from './constants';

describe('Swagger VilnaCRMEmail component', () => {
  const originalEmail: string | undefined = process.env.NEXT_PUBLIC_VILNACRM_GMAIL;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_VILNACRM_GMAIL = mockEmail;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_VILNACRM_GMAIL = originalEmail;
  });

  it('renders email address from env', () => {
    const { getByText } = render(<VilnaCRMEmail />);

    expect(getByText(mockEmail)).toBeInTheDocument();
  });
});
