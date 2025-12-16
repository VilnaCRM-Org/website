export default {
  wrapper: {
    display: 'inline-block',
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.lg}px)`]: {
      display: 'none',
    },
  },
  drawer: {
    zIndex: 3200,
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.lg}px)`]: {
      display: 'none',
    },
  },

  drawerContent: {
    maxWidth: '23.4375rem',
    width: '100dvw',
    px: '0.938rem',
    py: '0.375rem',
  },

  button: {
    minWidth: '0',
    padding: '0',
  },

  link: {
    width: '100%',
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
