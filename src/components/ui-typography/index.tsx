import { ThemeProvider, Typography } from '@mui/material';
import React from 'react';

import theme from './theme';
import { UiTypographyProps } from './types';

// Props are forwarded through an explicit allowlist, so anything a caller needs
// on the rendered element has to be named here — `aria-live`/`aria-atomic` are
// listed because the form validation message is a live region (#382 F3).
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
