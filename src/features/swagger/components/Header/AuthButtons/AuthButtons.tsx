import { Stack, Link } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiButton } from '@/components';

import styles from './styles';

function AuthButtons(): React.ReactElement {
  const { t } = useTranslation();

  const navigateToSignUp: () => void = () => {
    window.location.assign('/#signUp');
  };

  return (
    <Stack spacing={1} direction="row" sx={styles.wrapper}>
      <UiButton variant="outlined" size="small">
        <Link onClick={navigateToSignUp} sx={styles.link}>
          {t('header.actions.log_in')}
        </Link>
      </UiButton>
      <UiButton variant="contained" size="small">
        <Link onClick={navigateToSignUp} sx={styles.link}>
          {t('header.actions.try_it_out')}
        </Link>
      </UiButton>
    </Stack>
  );
}

export default AuthButtons;
