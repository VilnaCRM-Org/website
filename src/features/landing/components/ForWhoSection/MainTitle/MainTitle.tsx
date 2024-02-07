import { Box } from '@mui/material';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { UiButton, UiTypography } from '@/components';

import styles from './styles';

function MainTitle(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Box>
      <UiTypography variant="h2" sx={styles.title}>
        {t('for_who.heading_main')}
      </UiTypography>
      <UiTypography
        sx={styles.description}
        variant="bodyText18"
        maxWidth="21.438rem"
      >
        <Trans i18nKey="for_who.text_main" />
      </UiTypography>
      <UiButton
        variant="contained"
        size="medium"
        sx={styles.button}
        href="#signUp"
      >
        {t('for_who.button_text')}
      </UiButton>
    </Box>
  );
}

export default MainTitle;