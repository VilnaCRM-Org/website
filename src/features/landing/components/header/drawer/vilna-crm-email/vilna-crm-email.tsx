import { Stack } from '@mui/material';
import Link from 'next/link';
import React from 'react';

import { UiTypography } from '@/components';
import { env } from '@/config/env';

import styles from './styles';

function VilnaCRMEmail(): React.ReactElement {
  const email: string = env.NEXT_PUBLIC_VILNACRM_GMAIL;

  return (
    <Stack sx={styles.emailWrapper}>
      <Link href={`mailto:${email}`}>
        <Stack direction="row" sx={styles.emailRow}>
          <UiTypography sx={styles.at}>@</UiTypography>
          <UiTypography variant="demi18" sx={styles.emailText}>
            {email}
          </UiTypography>
        </Stack>
      </Link>
    </Stack>
  );
}

export default VilnaCRMEmail;
