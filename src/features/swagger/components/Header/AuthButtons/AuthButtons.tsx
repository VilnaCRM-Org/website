import { Stack, Link } from '@mui/material';
import { NextRouter, useRouter } from 'next/router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiButton } from '@/components';

import styles from './styles';

function AuthButtons(): React.ReactElement {
  const router: NextRouter = useRouter();
  const { t } = useTranslation();

  const navigateToSignUp: () => void = async () => {
    await router.push({ pathname: '/', hash: '#signUp' });
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
