import { render } from '@testing-library/react';
import { t } from 'i18next';

import AuthButtons from '../../features/landing/components/Header/AuthButtons/AuthButtons';

const buttonLogInText: string = t('header.actions.log_in');
const buttonSignUpText: string = t('header.actions.try_it_out');

it('should render two buttons with correct text and styles', () => {
  const { getByText } = render(<AuthButtons />);

  const logInButton: HTMLElement = getByText(buttonLogInText);
  const signUpButton: HTMLElement = getByText(buttonSignUpText);

  expect(logInButton).toBeInTheDocument();
  expect(signUpButton).toBeInTheDocument();
});

it('renders the sign-up CTA as a single link with no nested interactive element', () => {
  // The wrapper Stack is display:none until the lg breakpoint; jsdom can't apply the
  // media query, so the node is "hidden" and must be queried with hidden: true.
  const { getByRole } = render(<AuthButtons />);

  const ctaLink: HTMLElement = getByRole('link', { name: buttonSignUpText, hidden: true });

  expect(ctaLink.tagName).toBe('A');
  expect(ctaLink).toHaveAttribute('href', '#signUp');
  // Guard against the nested-interactive regression: an anchor must not wrap a button.
  expect(ctaLink.querySelector('button, [role="button"], [tabindex]')).toBeNull();
});
