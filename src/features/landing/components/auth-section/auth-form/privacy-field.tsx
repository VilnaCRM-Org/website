import React from 'react';
import { Controller } from 'react-hook-form';
import { Trans } from 'react-i18next';

import { UiCheckbox, UiLink, UiTypography } from '@/components';
import { env } from '@/config/env';

import styles from './styles';
import { AuthFormProps } from './types';

function PolicyConsentText(): React.ReactElement {
  return (
    <UiTypography variant="medium14" sx={styles.privacyText}>
      {/*
        The interpolation indices are positional over this element's children:
        <1> is the Privacy Policy link and <3> the Use Policy link. Reusing <1>
        for both — as the copy did before #382 — clones the first link twice, so
        "Use Policy" silently navigated to the privacy-policy URL.
      */}
      <Trans i18nKey="sign_up.form.confidential_text.fullText">
        I have read and accept the
        <UiLink
          href={env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </UiLink>
        and the
        <UiLink
          href={env.NEXT_PUBLIC_VILNACRM_USE_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Use Policy
        </UiLink>
        VilnaCRM Service
      </Trans>
    </UiTypography>
  );
}

function PrivacyField({
  control,
  formValidationErrors,
}: Pick<AuthFormProps, 'control' | 'formValidationErrors'>): React.ReactElement {
  return (
    <Controller
      control={control}
      name="Privacy"
      rules={{ required: true }}
      render={({ field: { value, onChange } }) => (
        <UiCheckbox
          onChange={onChange}
          checked={value}
          error={!!formValidationErrors.Privacy}
          sx={styles.labelText as React.CSSProperties}
          label={<PolicyConsentText />}
        />
      )}
    />
  );
}

export default PrivacyField;
