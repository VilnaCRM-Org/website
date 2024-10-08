import { Box, Stack } from '@mui/material';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { UiTypography } from '@/components/';

import styles from './styles';

function Heading(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Stack maxWidth="39.5rem">
      <UiTypography variant="h2" component="h2" sx={styles.title}>
        {t('why_us.heading')}
      </UiTypography>
      <UiTypography variant="bodyText18" sx={styles.text}>
        <Trans i18nKey="why_us.unlimited_subtitle" />
        <Box component="br" />
        <Trans i18nKey="why_us.business_subtitle" />
      </UiTypography>
    </Stack>
  );
}

export default Heading;
