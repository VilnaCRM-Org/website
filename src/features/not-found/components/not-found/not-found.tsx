import { Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiLink, UiTypography } from '@/components';

import styles from './styles';

function NotFound(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Box sx={styles.wrapper}>
      <UiTypography component="h1" variant="h2">
        {t('not_found.heading')}
      </UiTypography>
      <UiTypography sx={styles.hint}>{t('not_found.hint')}</UiTypography>
      <UiLink href="/">{t('not_found.home_link')}</UiLink>
    </Box>
  );
}

export default NotFound;
