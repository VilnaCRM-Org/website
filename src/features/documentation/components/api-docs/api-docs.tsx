import { Box } from '@mui/material';
import React from 'react';

import { UiTypography } from '@/components';

import styles from './styles';

function ApiDocs(): React.ReactElement {
  return (
    <Box sx={styles.wrapper}>
      <UiTypography component="h1" variant="h1">
        API Documentation (EN)
      </UiTypography>
      <UiTypography>This is the English version of the API documentation page.</UiTypography>
    </Box>
  );
}

export default ApiDocs;
