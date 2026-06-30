import { render } from '@testing-library/react';
import { t } from 'i18next';

import AuthButtons from '@landing/header/auth-buttons/auth-buttons';

const buttonLogInText: string = t('header.actions.log_in');
const buttonSignUpText: string = t('header.actions.try_it_out');

describe('integration: AuthButtons', () => {
  it('renders both auth buttons with the correct labels', () => {
    const { getByText } = render(<AuthButtons />);

    expect(getByText(buttonLogInText)).toBeInTheDocument();
    expect(getByText(buttonSignUpText)).toBeInTheDocument();
  });

  it('renders the sign-up CTA as a single anchor with no nested interactive element', () => {
    const { getByRole } = render(<AuthButtons />);

    const ctaLink: HTMLElement = getByRole('link', { name: buttonSignUpText, hidden: true });

    expect(ctaLink.tagName).toBe('A');
    expect(ctaLink).toHaveAttribute('href', '#signUp');
    expect(ctaLink.querySelector('button, [role="button"], [tabindex]')).toBeNull();
  });
});
