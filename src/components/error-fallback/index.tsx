import { Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiButton, UiLink, UiTypography } from '@/components';

import styles from './styles';
import { ErrorFallbackProps } from './types';

function ErrorFallback({ onRetry }: ErrorFallbackProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Box sx={styles.container} role="alert" id="app-error-fallback">
      <UiTypography component="h1" variant="h4" sx={styles.title}>
        {t('error_boundary.title')}
      </UiTypography>
      <UiTypography component="p" sx={styles.description}>
        {t('error_boundary.description')}
      </UiTypography>
      <Box sx={styles.actions}>
        <UiButton variant="contained" type="button" onClick={onRetry}>
          {t('error_boundary.retry_button')}
        </UiButton>
        <UiLink href="/">{t('error_boundary.home_link')}</UiLink>
      </Box>
    </Box>
  );
}

export default ErrorFallback;
