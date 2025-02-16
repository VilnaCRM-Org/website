import { MockedProvider } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import i18n, { t } from 'i18next';
import React from 'react';
import { I18nextProvider } from 'react-i18next';

import AuthSection from '../../features/landing/components/AuthSection/AuthSection';
import { socialLinks } from '../../features/landing/components/AuthSection/constants';
import { SocialLink } from '../../features/landing/types/authentication/social';

const authSectionSelector: string = 'section';

const signupHeading: string = t('sign_up.vilna_text');

describe('AuthSection', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MockedProvider mocks={[]} addTypename={false}>
        <AuthSection />
      </MockedProvider>
    );

    const authSection: HTMLElement | null = container.querySelector(authSectionSelector);
    expect(authSection).toBeInTheDocument();
  });

  test('renders SignUpText component and AuthForm components', () => {
    const { getByText } = render(
      <MockedProvider mocks={[]} addTypename={false}>
        <AuthSection />
      </MockedProvider>
    );

    const signUpText: HTMLElement = getByText(signupHeading);

    expect(signUpText).toBeInTheDocument();
    expect(screen.getByTestId('auth-form')).toBeInTheDocument();
  });
  test('renders AuthForm, and don`t render Notification component', () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <AuthSection />
      </MockedProvider>
    );

    expect(screen.getByText(signupHeading)).toBeVisible();
    expect(screen.getByTestId('notification')).not.toBeVisible();
  });

  test('renders all social links', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MockedProvider mocks={[]} addTypename={false}>
          <AuthSection />
        </MockedProvider>
      </I18nextProvider>
    );

    socialLinks.forEach(({ title }: SocialLink) => {
      expect(screen.getByText(i18n.t(title))).toBeInTheDocument();
    });
  });
  test('does not render Notification component at all', () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <AuthSection />
      </MockedProvider>
    );

    expect(screen.getByText(signupHeading)).toBeVisible();
    expect(screen.queryByTestId('notification')).not.toBeVisible();
  });
});
