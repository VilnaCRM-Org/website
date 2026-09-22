import { Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiLink, UiTypography } from '@/components';

import styles from './styles';

function ApiDocs(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Box sx={styles.wrapper}>
      <UiTypography component="h1" variant="h1">
        {t('documentation.api_docs.heading')}
      </UiTypography>
      <UiTypography>{t('documentation.api_docs.body')}</UiTypography>
      <UiLink href="/swagger">{t('documentation.api_docs.swagger_link')}</UiLink>
    </Box>
  );
}

export default ApiDocs;
