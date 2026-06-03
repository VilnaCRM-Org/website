import { Stack } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiButton } from '@/components';

import styles from './styles';

function AuthButtons(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Stack spacing={1} direction="row" sx={styles.wrapper}>
      <UiButton variant="outlined" size="small" disabled>
        {t('header.actions.log_in')}
      </UiButton>
      <UiButton href="#signUp" variant="contained" size="small">
        {t('header.actions.try_it_out')}
      </UiButton>
    </Stack>
  );
}

export default AuthButtons;
