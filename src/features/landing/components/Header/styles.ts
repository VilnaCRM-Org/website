import colorTheme from '@/components/UiColorTheme';

export default {
  headerWrapper: {
    backgroundColor: colorTheme.palette.white.main,
    boxShadow: 'none',
    position: 'sticky',
    zIndex: 3000,
  },

  logoLink: {
    display: 'inline-flex',
    alignItems: 'center',
    cursor: 'pointer',
  },

  logo: {
    width: '8.188rem',
    height: '2.75rem',
  },
};
