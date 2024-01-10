'use client';

import { Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiTypography } from '@/components/ui';

import { SocialList } from '../SocialList';

import { signUpTextStyles } from './styles';

function SignUpText() {
  const { t } = useTranslation();
  return (
    <Box sx={signUpTextStyles.textWrapper}>
      <UiTypography variant="h2" sx={signUpTextStyles.title}>
        {t('sign_up.main_heading')}
        <UiTypography
          variant="h2"
          component="span"
          sx={signUpTextStyles.titleVilnaCRM}
        >
          {' VilnaCRM'}
        </UiTypography>
      </UiTypography>
      <Box sx={signUpTextStyles.socialListWrapper}>
        <UiTypography variant="bold22" sx={signUpTextStyles.signInText}>
          {t('sign_up.socials_main_heading')}
        </UiTypography>
        <SocialList />
      </Box>
    </Box>
  );
}

export default SignUpText;