import { MockedProvider } from '@apollo/client/testing/react';
import { render, screen } from '@testing-library/react';
import i18n, { t, TFunction } from 'i18next';
import React from 'react';
import { I18nextProvider } from 'react-i18next';

import AuthSection from '../../features/landing/components/AuthSection/AuthSection';
import { socialLinks } from '../../features/landing/components/AuthSection/constants';
import { SocialLink } from '../../features/landing/types/authentication/social';

import { renderWithProviders } from './utils';

const authSectionSelector: string = 'section';

const signupHeading: string = t('sign_up.vilna_text');
const successTitleText: string = t('notifications.success.title');

describe('AuthSection', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<AuthSection />);

    const authSection: HTMLElement | null = container.querySelector(authSectionSelector);
    expect(authSection).toBeInTheDocument();
  });

  test('renders SignUpText component and AuthForm components', () => {
    const { getByText } = renderWithProviders(<AuthSection />);

    const signUpText: HTMLElement = getByText(signupHeading);

    expect(signUpText).toBeInTheDocument();
    expect(screen.getByRole('form')).toBeInTheDocument();
  });
  test('renders AuthForm, and don`t render Notification component', () => {
    renderWithProviders(<AuthSection />);

    expect(screen.getByText(signupHeading)).toBeVisible();
    expect(screen.getByText(successTitleText)).not.toBeVisible();
  });

  test('renders all social links', () => {
    renderWithProviders(<AuthSection />);

    socialLinks.forEach(({ title }: SocialLink) => {
      expect(screen.getByText(i18n.t(title))).toBeInTheDocument();
    });
  });
  test('renders all social links with fallback text if translation is missing', () => {
    const mockT: jest.SpyInstance<string, Parameters<TFunction>> = jest
      .spyOn(i18n, 't')
      .mockImplementation((key =>
        typeof key === 'string' ? key : key[0] || 'Fallback Text') as typeof i18n.t);

    render(
      <I18nextProvider i18n={i18n}>
        <MockedProvider mocks={[]}>
          <AuthSection />
        </MockedProvider>
      </I18nextProvider>
    );

    socialLinks.forEach(({ title }: SocialLink) => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });

    mockT.mockRestore();
  });
});
