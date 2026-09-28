import { render } from '@testing-library/react';
import { t } from 'i18next';

import { PrivacyPolicy } from '@/components/ui-footer/privacy-policy';

const privacyPolicyText: string = t('footer.privacy');
const usagePolicyText: string = t('footer.usage_policy');

describe('PrivacyPolicy', () => {
  test('renders privacy and usage policy links', () => {
    const { getByText } = render(<PrivacyPolicy />);
    const privacyLink: HTMLElement = getByText(privacyPolicyText);
    const usagePolicyLink: HTMLElement = getByText(usagePolicyText);
    expect(privacyLink).toBeInTheDocument();
    expect(usagePolicyLink).toBeInTheDocument();
  });

  test('privacy link points to correct URL', () => {
    const { getByText } = render(<PrivacyPolicy />);
    const privacyLink: HTMLElement = getByText(privacyPolicyText);
    expect(privacyLink).toBeInTheDocument();
  });

  test('usage policy link points to correct URL', () => {
    const { getByText } = render(<PrivacyPolicy />);
    const usagePolicyLink: HTMLElement = getByText(usagePolicyText);
    expect(usagePolicyLink).toBeInTheDocument();
  });

  test('styles both policy links as the same unstyled-text pill', () => {
    const { getByRole } = render(<PrivacyPolicy />);
    const pillStyle: Record<string, string> = {
      textDecoration: 'none',
      padding: '0.5rem 1rem',
      borderRadius: '0.5rem',
    };

    expect(getByRole('link', { name: privacyPolicyText })).toHaveStyle(pillStyle);
    expect(getByRole('link', { name: usagePolicyText })).toHaveStyle(pillStyle);
  });
});
