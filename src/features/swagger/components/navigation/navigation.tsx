import { Box, Link } from '@mui/material';
import NextLink from 'next/link';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiTypography } from '@/components';

import Svg from '../../assets/svg/navigation/arrow.svg';

import styles from './styles';

function Navigation(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Box sx={styles.navigationWrapper}>
      <Link
        component={NextLink}
        href="/"
        underline="none"
        color="inherit"
        sx={styles.navigationLink}
      >
        <Image src={Svg} alt="" aria-hidden="true" />
        <UiTypography component="span" variant="medium16" sx={styles.navigationText}>
          {t('navigation.navigate_to_home_page')}
        </UiTypography>
      </Link>
    </Box>
  );
}

export default Navigation;
