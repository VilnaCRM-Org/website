import { Box, Link } from '@mui/material';
import React from 'react';

import { UiTypography } from '@/components';
import { env } from '@/config/env';

import styles from './styles';

function VilnaCRMEmail(): React.ReactElement {
  const email: string = env.NEXT_PUBLIC_VILNACRM_GMAIL;

  return (
    <Box sx={styles.emailWrapper}>
      <UiTypography variant="medium15" sx={styles.emailText}>
        <Link href={`mailto:${email}`} sx={styles.emailLink}>
          {email}
        </Link>
      </UiTypography>
    </Box>
  );
}

export default VilnaCRMEmail;
