/**
 * Integration coverage: AuthSection presentational sub-components.
 *
 * Renders the REAL `SignUpText`, `SocialList`, `SocialItem` and `PasswordTip`
 * with the live i18next instance so the translated copy and the social-link
 * mapping execute. These components carry no Apollo wiring, so no provider is
 * needed. The `constants` module (real `socialLinks` + faker-generated
 * `testSocialLink`) and the index barrels are imported directly so their module
 * bodies are counted.
 */
import { render, screen } from '@testing-library/react';
import { t } from 'i18next';

import { socialLinks } from '@landing/AuthSection/constants';
import { PasswordTip } from '@landing/AuthSection/PasswordTip';
import { SignUpText } from '@landing/AuthSection/SignUpText';
import { SocialItem } from '@landing/AuthSection/SocialItem';
import { SocialList } from '@landing/AuthSection/SocialList';

import { SocialLink } from '../../../../src/features/landing/types/authentication/social';
import { testSocialLink } from '../../../../src/test/testing-library/fixtures/auth-social.fixtures';

describe('integration: PasswordTip', () => {
  it('renders the recommendation text and all three option lines', () => {
    render(<PasswordTip />);

    expect(
      screen.getByText(t('sign_up.form.password_tip.recommendation_text'))
    ).toBeInTheDocument();
    expect(screen.getByText(t('sign_up.form.password_tip.options.option_1'))).toBeInTheDocument();
    expect(screen.getByText(t('sign_up.form.password_tip.options.option_2'))).toBeInTheDocument();
    expect(screen.getByText(t('sign_up.form.password_tip.options.option_3'))).toBeInTheDocument();
  });
});

describe('integration: SocialItem', () => {
  it('renders a disabled button with a decorative icon and translated title', () => {
    const { container } = render(<SocialItem item={testSocialLink} />);

    expect(screen.getByText(testSocialLink.title)).toBeInTheDocument();

    const image: HTMLImageElement | null = container.querySelector('img');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', '');

    const button: HTMLElement = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('name', 'socialButton');
  });
});

describe('integration: SocialList', () => {
  it('renders one item per social link', () => {
    render(<SocialList socialLinks={socialLinks} />);

    socialLinks.forEach(({ title }: SocialLink) => {
      expect(screen.getByText(t(title))).toBeInTheDocument();
    });
  });

  it('renders nothing when the list is empty', () => {
    const { container } = render(<SocialList socialLinks={[]} />);

    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});

describe('integration: SignUpText', () => {
  it('renders the heading, vilna text, socials heading and the social list', () => {
    render(<SignUpText socialLinks={socialLinks} />);

    expect(screen.getByText(t('sign_up.vilna_text'))).toBeInTheDocument();
    expect(screen.getByText(t('sign_up.socials_main_heading'))).toBeInTheDocument();

    socialLinks.forEach(({ title }: SocialLink) => {
      expect(screen.getByText(t(title))).toBeInTheDocument();
    });
  });

  it('renders without crashing when there are no social links', () => {
    render(<SignUpText socialLinks={[]} />);

    expect(screen.getByText(t('sign_up.socials_main_heading'))).toBeInTheDocument();
  });
});
