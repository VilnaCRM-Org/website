import { Theme, createTheme } from '@mui/material';

import { inter } from '@/config/Fonts/inter';

import colorTheme from '../ui-color-theme';

export const theme: Theme = createTheme({
  components: {
    MuiLink: {
      styleOverrides: {
        root: {
          position: 'absolute',
          width: '1px',
          height: '1px',
          margin: '-1px',
          padding: 0,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
          '&:focus': {
            position: 'fixed',
            top: '1rem',
            left: '1rem',
            width: 'auto',
            height: 'auto',
            margin: 0,
            overflow: 'visible',
            clip: 'auto',
            whiteSpace: 'normal',
            zIndex: 3300,
            padding: '0.75rem 1.5rem',
            backgroundColor: colorTheme.palette.white.main,
            color: colorTheme.palette.primary.main,
            fontFamily: inter.style.fontFamily,
            fontSize: '1rem',
            fontWeight: '700',
            borderRadius: '0.5rem',
            boxShadow: `0 0 0 2px ${colorTheme.palette.primary.main}`,
            textDecoration: 'underline',
          },
        },
      },
    },
  },
});
