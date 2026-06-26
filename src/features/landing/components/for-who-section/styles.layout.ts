import breakpointsTheme from '@/components/ui-breakpoints';
import colorTheme from '@/components/ui-color-theme';

export default {
  wrapper: {
    background: colorTheme.palette.backgroundGrey100.main,
    maxWidth: '100dvw',
    overflow: 'hidden',
    position: 'relative',
    minHeight: '30rem',
    contain: 'layout',
  },

  lgCardsWrapper: {
    display: 'flex',
    [`@media (max-width: 968px)`]: {
      display: 'none',
    },
  },

  smCardsWrapper: {
    display: 'none',
    [`@media (max-width: 968px)`]: {
      display: 'flex',
      justifyContent: 'center',
    },
  },

  content: {
    pt: '8.25rem',
    position: 'relative',
    marginBottom: '-2rem',
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.lg}px)`]: {
      pt: '7.375rem',
      paddingBottom: '-2rem',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      pt: '2rem',
      paddingBottom: '-2rem',
    },
  },

  line: {
    position: 'relative',
    background: colorTheme.palette.white.main,
    minHeight: '6.25rem',
    zIndex: 1,
    marginTop: '-3.75rem',
    '@media (max-width: 1130.98px)': {
      minHeight: '11.188rem',
      marginTop: '-8.625rem',
    },
    [`@media (max-width: 968px)`]: {
      display: 'none',
    },
  },

  container: {
    position: 'relative',
    marginTop: '1.5rem',
    marginBottom: '-6rem',
    display: 'flex',
    [`@media (min-width: 426px)`]: {
      justifyContent: 'center',
      marginTop: '0rem',
      marginLeft: 'auto',
      marginRight: 'auto',
      width: 'auto',
      maxWidth: '100%',
      flexGrow: 1,
      transform: 'scale(1.1)',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      marginTop: '1rem',
      transform: 'none',
    },
    [`@media (min-width: 641px)`]: {
      marginTop: '-8rem',
      width: '85vw',
      maxWidth: '1000px',
      transform: 'scale(1.1)',
    },
    [`@media (min-width: 969px)`]: {
      width: 'auto',
      transform: 'none',
      marginRight: '0',
      marginTop: '-30rem',
      marginLeft: '17.6rem',
    },
    [`@media (min-width: 1131px)`]: {
      marginTop: '-27.2rem',
      marginLeft: '38.2rem',
    },
  },

  svgContainer: {
    [`@media (min-width: 969px)`]: {
      marginTop: '-15rem',
    },
  },
};
