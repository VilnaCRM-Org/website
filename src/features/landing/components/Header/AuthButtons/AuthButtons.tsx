import { Link, Stack } from '@mui/material';
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
      <Link href="#signUp" sx={styles.link}>
        <UiButton component="span" variant="contained" size="small">
          {t('header.actions.try_it_out')}
        </UiButton>
      </Link>
    </Stack>
  );
}

export default AuthButtons;
