/**
 * Integration coverage: src/components/UiFooter/**.
 *
 * Renders the real UiFooter and each of its child components
 * (DefaultFooter, Mobile, PrivacyPolicy, VilnaCRMEmail) through the
 * i18next-backed integration environment so every branch, the barrels,
 * and the constants module are exercised.
 */
import { render, screen, within } from '@testing-library/react';
import { t } from 'i18next';

import UiFooter from '@/components/UiFooter';
import { socialLinks } from '@/components/UiFooter/constants';
import { DefaultFooter } from '@/components/UiFooter/DefaultFooter';
import { Mobile } from '@/components/UiFooter/Mobile';
import { PrivacyPolicy } from '@/components/UiFooter/PrivacyPolicy';
import { VilnaCRMEmail } from '@/components/UiFooter/VilnaCRMEmail';

import { SocialMedia } from '../../../../src/features/landing/types/social-media';

const stackElementClass: string = '.MuiStack-root';
const containerElementClass: string = '.MuiContainer-root';

const logoAlt: string = t('footer.logo_alt');
const privacyText: string = t('footer.privacy');
const usagePolicyText: string = t('footer.usage_policy');
const expectedEmail: string = process.env.NEXT_PUBLIC_VILNACRM_GMAIL ?? 'info@vilnacrm.com';

const localizedRegExp: (key: string) => RegExp = key => new RegExp(t(key));

const mockedSocialLinks: SocialMedia[] = [
  {
    id: 'Instagram-link',
    icon: '/instagram.svg',
    alt: 'footer.alt_images.instagram',
    linkHref: 'https://www.instagram.com/',
    ariaLabel: 'footer.aria_labels.instagram',
  },
];

describe('UiFooter (integration)', () => {
  it('renders the footer landmark with default and adaptive sections', () => {
    const { container } = render(<UiFooter />);

    const footerElement: HTMLElement | null = container.querySelector('footer');
    expect(footerElement).toBeInTheDocument();
    expect(footerElement).toHaveAttribute('id', 'Contacts');
    expect(container.querySelector(stackElementClass)).toBeInTheDocument();
    expect(container.querySelector(containerElementClass)).toBeInTheDocument();
  });

  it('exposes social links constants consumed by the footer', () => {
    expect(socialLinks).toHaveLength(4);
    socialLinks.forEach(link => {
      expect(link.id).toBeTruthy();
      expect(link.linkHref).toBeTruthy();
    });
  });
});

describe('DefaultFooter (integration)', () => {
  it('renders logo, copyright, current year and child sections', () => {
    const currentYear: number = new Date().getFullYear();
    const { container } = render(<DefaultFooter socialLinks={mockedSocialLinks} />);

    expect(container.querySelector(stackElementClass)).toBeInTheDocument();
    expect(screen.getByAltText(logoAlt)).toBeInTheDocument();
    expect(screen.getByText(localizedRegExp('footer.copyright'))).toBeInTheDocument();
    expect(screen.getByText(currentYear.toString())).toBeInTheDocument();
  });
});

describe('Mobile (integration)', () => {
  it('renders the adaptive container with logo, copyright and year', () => {
    const currentYear: number = new Date().getFullYear();
    const { container } = render(<Mobile socialLinks={mockedSocialLinks} />);

    expect(container.querySelector(containerElementClass)).toBeInTheDocument();
    expect(screen.getByAltText(logoAlt)).toBeInTheDocument();
    expect(screen.getByText(localizedRegExp('footer.copyright'))).toBeInTheDocument();
    expect(screen.getByText(currentYear.toString())).toBeInTheDocument();
  });
});

describe('PrivacyPolicy (integration)', () => {
  it('renders privacy and usage policy links pointing to the README', () => {
    render(<PrivacyPolicy />);

    const privacyLink: HTMLElement = screen.getByText(privacyText);
    const usagePolicyLink: HTMLElement = screen.getByText(usagePolicyText);

    expect(privacyLink).toBeInTheDocument();
    expect(usagePolicyLink).toBeInTheDocument();

    const privacyAnchor: HTMLElement | null = privacyLink.closest('a');
    const usageAnchor: HTMLElement | null = usagePolicyLink.closest('a');
    expect(privacyAnchor).toHaveAttribute(
      'href',
      'https://github.com/VilnaCRM-Org/website/blob/main/README.md'
    );
    expect(privacyAnchor).toHaveAttribute('target', '_blank');
    expect(usageAnchor).toHaveAttribute(
      'href',
      'https://github.com/VilnaCRM-Org/website/blob/main/README.md'
    );
    expect(usageAnchor).toHaveAttribute('target', '_blank');
  });
});

describe('VilnaCRMEmail (integration)', () => {
  it('renders the mailto email link from the public env var', () => {
    const { container } = render(<VilnaCRMEmail />);

    expect(screen.getByText(expectedEmail)).toBeInTheDocument();
    const anchor: HTMLElement | null = within(container).getByText(expectedEmail).closest('a');
    expect(anchor).toHaveAttribute('href', 'mailto:info@vilnacrm.com');
  });
});
