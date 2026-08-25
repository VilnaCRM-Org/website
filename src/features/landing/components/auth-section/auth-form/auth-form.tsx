import { Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiButton, UiTypography } from '@/components';

import PrivacyField from './privacy-field';
import SignUpFields from './sign-up-fields';
import styles from './styles';
import { AuthFormProps } from './types';

const FORM_HEADING_ID: string = 'sign-up-form-heading';

function AuthForm({
  onSubmit,
  handleSubmit,
  control,
  formValidationErrors,
  loading,
}: AuthFormProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    // Named by its own localized heading rather than a hardcoded English
    // identifier, which screen readers used to announce verbatim.
    <Box component="form" onSubmit={handleSubmit(onSubmit)} aria-labelledby={FORM_HEADING_ID}>
      <UiTypography id={FORM_HEADING_ID} variant="h4" component="h4" sx={styles.formTitle}>
        {t('sign_up.form.heading_main')}
      </UiTypography>
      <SignUpFields control={control} />
      <PrivacyField control={control} formValidationErrors={formValidationErrors} />

      <Box sx={styles.buttonWrapper}>
        <UiButton
          sx={styles.button}
          variant="contained"
          size="medium"
          type="submit"
          fullWidth
          disabled={loading}
        >
          {t('sign_up.form.button_text')}
        </UiButton>
      </Box>
    </Box>
  );
}

export default AuthForm;
