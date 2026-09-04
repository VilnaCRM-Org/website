import { render, screen } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';
import { useForm } from 'react-hook-form';

import AuthForm from '../../features/landing/components/auth-section/auth-form/auth-form';
import { RegisterItem } from '../../features/landing/types/authentication/form';

const privacyPolicyUrl: string = 'https://example.com/privacy-policy';
const usePolicyUrl: string = 'https://example.com/use-policy';

// The two policy links are rendered from a single <Trans> string whose tag
// indices decide which <UiLink> each half of the sentence is cloned from. Both
// production URLs currently resolve to the same placeholder host, which is what
// hid the duplicated `<1>` index until #382 — so the URLs are forced apart here.
jest.mock('../../config/env', () => ({
  env: {
    NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL: 'https://example.com/privacy-policy',
    NEXT_PUBLIC_VILNACRM_USE_POLICY_URL: 'https://example.com/use-policy',
  },
}));

function Harness(): React.ReactElement {
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterItem>({ mode: 'onTouched' });

  return (
    <AuthForm
      onSubmit={() => Promise.resolve()}
      handleSubmit={handleSubmit}
      formValidationErrors={errors}
      control={control}
      loading={false}
    />
  );
}

// The new-tab cue UiLink appends to every `_blank` link, so a name assertion
// stays anchored on the policy copy without hard-coding the localized suffix.
const newTabLabel: string = t('accessibility.opens_in_new_tab');

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Not anchored: the copy still discriminates the two links from each other, and
// anchoring would make the assertion depend on the exact leading/trailing
// whitespace the <Trans> segment happens to carry.
function linkName(copy: string): RegExp {
  return new RegExp(`${escapeForRegExp(copy.trim())}\\s+${escapeForRegExp(newTabLabel)}`);
}

describe('AuthForm policy links', () => {
  it('points each policy link at its own document', () => {
    render(<Harness />);

    const links: HTMLElement[] = screen.getAllByRole('link');

    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', privacyPolicyUrl);
    expect(links[1]).toHaveAttribute('href', usePolicyUrl);
  });

  it('labels each link with its own policy name', () => {
    render(<Harness />);

    const usePolicyName: RegExp = /use policy|використ/i;
    const usePolicyLink: HTMLElement = screen.getByRole('link', { name: usePolicyName });

    expect(usePolicyLink).toHaveAttribute('href', usePolicyUrl);
  });

  it('opens both policies in a new tab with the referrer withheld', () => {
    render(<Harness />);

    screen.getAllByRole('link').forEach(link => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  // Both links open a new tab, so each accessible name now carries the localized
  // "opens in new tab" cue UiLink appends. Matching on the copy alone would
  // silently start matching nothing.
  it('announces that each policy opens in a new tab', () => {
    render(<Harness />);

    screen.getAllByRole('link').forEach(link => {
      expect(link).toHaveAccessibleName(new RegExp(escapeForRegExp(newTabLabel), 'i'));
    });
  });

  it('maps each interpolation index to the link carrying that copy', () => {
    render(<Harness />);

    // The translation marks the two links with distinct indices; reusing one
    // index for both clones the first link and silently sends the second
    // policy to the wrong URL.
    const sentence: string = t('sign_up.form.confidential_text.fullText');
    const privacyCopy: string = sentence.replace(/^.*<1>(.*?)<\/1>.*$/s, '$1');
    const useCopy: string = sentence.replace(/^.*<3>(.*?)<\/3>.*$/s, '$1');

    expect(privacyCopy).not.toBe(useCopy);
    expect(screen.getByRole('link', { name: linkName(privacyCopy) })).toHaveAttribute(
      'href',
      privacyPolicyUrl
    );
    expect(screen.getByRole('link', { name: linkName(useCopy) })).toHaveAttribute(
      'href',
      usePolicyUrl
    );
  });
});
