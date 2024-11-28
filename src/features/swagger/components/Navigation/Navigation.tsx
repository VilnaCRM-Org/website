import { Box, Stack } from '@mui/material';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiTypography } from '@/components';

import Svg from '../../assets/svg/navigation/arrow.svg';

import styles from './styles';

function Navigation(): React.ReactElement {
  const { t } = useTranslation();

  const navigateHome: () => void = () => {
    window.location.assign('/');
  };

  return (
    <Box sx={styles.navigationWrapper} onClick={navigateHome} role="navigation">
      <Stack direction="row" role="navigation" sx={styles.navigationButton}>
        <Image src={Svg} alt={t('navigation.back_arrow_description')} />
        <UiTypography variant="medium16" sx={styles.navigationText}>
          {t('navigation.navigate_to_home_page')}
        </UiTypography>
      </Stack>
    </Box>
  );
}

export default Navigation;
