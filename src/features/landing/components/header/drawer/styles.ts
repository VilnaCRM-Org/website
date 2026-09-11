import breakpointsTheme from '@/components/ui-breakpoints';

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
    width: '23.4375rem',
    textAlign: 'center',
    px: '0.938rem',
    py: '0.375rem',
  },

  header: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  actions: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.563rem',
    mt: '0.75rem',
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
