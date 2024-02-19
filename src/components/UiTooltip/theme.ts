import { Theme, createTheme } from '@mui/material';

import breakpointsTheme from '../UiBreakpoints';
import colorTheme from '../UiColorTheme';

export const theme: Theme = createTheme({
  components: {
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colorTheme.palette.white.main,
          borderRadius: '0.5rem',
          border: `1px solid ${colorTheme.palette.grey400.main}`,
          maxWidth: '20.625rem',
          padding: '1.12rem 1.5rem',
          [`@media (max-width: ${breakpointsTheme.breakpoints.values.lg}px)`]: {
            display: 'none',
          },
        },
        arrow: {
          color: colorTheme.palette.grey400.main,
        },
      },
    },
  },
});
