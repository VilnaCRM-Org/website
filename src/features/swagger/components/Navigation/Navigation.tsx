import { Box, Stack } from '@mui/material';
import { NextRouter, useRouter } from 'next/router';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiTypography } from '@/components';

import Svg from '../../assets/svg/navigation/arrow.svg';

import styles from './styles';

function Navigation(): React.ReactElement {
  const router: NextRouter = useRouter();
  const { t } = useTranslation();

  const navigateHome: () => void = () => {
    router.push('/');
  };

  return (
    <Box sx={styles.navigationWrapper} onClick={navigateHome}>
      <Stack direction="row" role="navigation" sx={styles.navigationButton}>
        <Image src={Svg} alt="arrow" />
        <UiTypography variant="medium16" sx={styles.navigationText}>
          {t('navigation.navigate_to_home_page')}
        </UiTypography>
      </Stack>
    </Box>
  );
}

export default Navigation;
