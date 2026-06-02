import { Box, Stack } from '@mui/material';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { UiButton, UiTypography } from '@/components';

import styles from './styles';

function TextInfo(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Stack sx={styles.textWrapper}>
      <UiTypography component="h1" variant="h1" sx={styles.title}>
        <Trans i18nKey="about_vilna.heading_first_main" />
        <Box component="br" />
        <Trans i18nKey="about_vilna.heading_second_main" />
      </UiTypography>
      <UiTypography variant="bodyText18" sx={styles.text}>
        {t('about_vilna.text_main')}
      </UiTypography>
      <UiButton
        href="#signUp"
        sx={{ ...styles.link, ...styles.button } as React.CSSProperties}
        variant="contained"
        size="medium"
      >
        {t('about_vilna.button_main')}
      </UiButton>
    </Stack>
  );
}

export default TextInfo;
