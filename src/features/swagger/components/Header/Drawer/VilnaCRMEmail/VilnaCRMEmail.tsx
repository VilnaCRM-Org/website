import { Stack } from '@mui/material';
import Link from 'next/link';
import Image from 'next-export-optimize-images/image';
import React from 'react';

import { UiTypography } from '@/components/';

import At from '../../../../assets/svg/header-drawer/at-sign.svg';

import styles from './styles';

function VilnaCRMEmail(): React.ReactElement {
  return (
    <Stack sx={styles.emailWrapper} justifyContent="center">
      <Link href="mailto:info@vilnacrm.com">
        <Stack justifyContent="center" alignItems="center" gap="0.62rem" flexDirection="row">
          <Image src={At} width={20} height={20} alt="logo" style={styles.at} />
          <UiTypography variant="demi18" sx={styles.emailText}>
            {process.env.NEXT_PUBLIC_VILNACRM_GMAIL}
          </UiTypography>
        </Stack>
      </Link>
    </Stack>
  );
}

export default VilnaCRMEmail;
