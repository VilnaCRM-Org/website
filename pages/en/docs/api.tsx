import { Box } from '@mui/material';
import React from 'react';

import { UiTypography } from '@/components';

export default function ApiDocsEnPage(): React.ReactElement {
  return (
    <Box sx={{ p: 4 }}>
      <UiTypography component="h1" variant="h1">
        API Documentation (EN)
      </UiTypography>
      <UiTypography>This is the English version of the API documentation page.</UiTypography>
    </Box>
  );
}
