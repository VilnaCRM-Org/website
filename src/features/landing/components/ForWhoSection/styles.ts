import breakpointsTheme from '@/components/UiBreakpoints';
import colorTheme from '@/components/UiColorTheme';

export default {
  wrapper: {
    background: colorTheme.palette.backgroundGrey100.main,
    maxWidth: '100dvw',
    overflow: 'hidden',
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
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.lg}px)`]: {
      pt: '7.375rem',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      pt: '2rem',
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
    marginTop: '1.5rem',
    marginBottom: '-6rem',
    display: 'flex',
  },

  svgContainer: {
    // Hidden in mobile-first approach. Will be displayed in tablet and desktop layouts.
  },

  circle: {
    width: '0.5rem',
    height: '0.5rem',
    marginTop: '5.1rem',
    marginLeft: '1.5rem',
  },

  rhombus: {
    width: '1.5rem',
    height: '1.5rem',
    marginTop: '9.1rem',
    marginLeft: '1.1rem',
  },

  pointContainer: {
    display: 'flex',
    marginTop: '0.5rem',
    marginLeft: '0.5rem'
  },

  point6: {
    marginLeft: '0.9rem',
    marginTop: '0.9rem'
  },

  point8: {
    marginLeft: '0.2rem',
    marginTop: '0.4rem'
  },

  point10: {
    marginLeft: '0.2rem',
  },

  square: {
    width: '20rem',
    height: '20rem',
    marginTop: '6.6rem',
    marginLeft: '0.6rem',
    backgroundColor: '#1EAEFF',
    borderRadius: '6%',
  },

  bigScreen: {
    width: '18.5rem',
    height: 'auto',
    marginTop: '-2.8rem',
    marginLeft: '1.2rem',
    zIndex: 0,
    borderRadius: '0.6rem',
  },

  smallScreen: {
    width: '9.3rem',
    height: 'auto',
    marginTop: '-6rem',
    marginLeft: '11.5rem',
    zIndex: 100,
    borderRadius: '0.6rem',
  },

  waves: {
    // Hidden in mobile-first approach. Will be displayed in tablet and desktop layouts.
    display: 'none',
  },

  hexagon: {
    // Hidden in mobile-first approach. Will be displayed in tablet and desktop layouts.
    display: 'none',
  },

  triangle: {
    // Hidden in mobile-first approach. Will be displayed in tablet and desktop layouts.
    display: 'none',
  },
};
