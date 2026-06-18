/**
 * Integration coverage for the swagger drawer `VilnaCRMEmail` component.
 *
 * Renders the real component (and its `styles.ts`) and asserts it surfaces the
 * email taken from `NEXT_PUBLIC_VILNACRM_GMAIL`.
 */
import { render, screen } from '@testing-library/react';

import VilnaCRMEmail from '@/features/swagger/components/Header/Drawer/VilnaCRMEmail/VilnaCRMEmail';

const EMAIL = 'info@vilnacrm.com';

describe('integration: swagger VilnaCRMEmail', () => {
  const original = process.env.NEXT_PUBLIC_VILNACRM_GMAIL;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_VILNACRM_GMAIL = EMAIL;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_VILNACRM_GMAIL = original;
  });

  it('renders the email address from the environment', () => {
    render(<VilnaCRMEmail />);

    expect(screen.getByText(EMAIL)).toBeInTheDocument();
  });
});
