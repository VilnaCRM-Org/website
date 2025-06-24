import { Box } from '@mui/material';
import React from 'react';

import { UiTypography } from '@/components';

export default function ApiDocsEnPage(): React.ReactElement {
  return (
    <Box style={{ padding: '2rem' }}>
      <UiTypography component="h3" variant="h1">
        API Documentation (EN)
      </UiTypography>
      <UiTypography>This is the English version of the API documentation page.</UiTypography>
    </Box>
  );
}
