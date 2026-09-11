import { ThemeProvider, Typography } from '@mui/material';
import React from 'react';

import theme from './theme';
import { UiTypographyProps } from './types';

function UiTypography({
  sx,
  children,
  component,
  variant,
  id,
  role,
  htmlFor,
  'aria-live': ariaLive,
  'aria-atomic': ariaAtomic,
}: UiTypographyProps): React.ReactElement {
  return (
    <ThemeProvider theme={theme}>
      <Typography
        sx={sx}
        component={component || 'p'}
        variant={variant}
        id={id}
        role={role}
        htmlFor={htmlFor}
        aria-live={ariaLive}
        aria-atomic={ariaAtomic}
      >
        {children}
      </Typography>
    </ThemeProvider>
  );
}

export default UiTypography;
