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
    position: 'relative',
    marginTop: '1.5rem',
    marginBottom: '-6rem',
    display: 'flex',
    [`@media (min-width: 968px)`]: {
      marginTop: '-30rem',
      marginLeft: '17.6rem',
    },
    [`@media (min-width: 1131px)`]: {
      marginTop: '-27.2rem',
      marginLeft: '38.2rem'
    },
  },

  svgContainer: {
    // The container has elements inside, but no styles are needed except for the tablet layout. 
    [`@media (min-width: 968px)`]: {
      marginTop: '-15rem',
    },
  },

  circle: {
    width: '0.5rem',
    height: '0.5rem',
    marginTop: '5.1rem',
    marginLeft: '1.5rem',
    [`@media (min-width: 968px)`]: {
      width: '0.8rem',
      height: '0.8rem',
      marginTop: '2rem',
      marginLeft: '2rem',
    },
    [`@media (min-width: 1131px)`]: {
    position: 'absolute',
    marginTop: '1.9rem',
    marginLeft: '-9.4rem'
    },
  },

  rhombus: {
    width: '1.5rem',
    height: '1.5rem',
    marginTop: '9.1rem',
    marginLeft: '1.1rem',
    [`@media (min-width: 968px)`]: {
      width: '2.5rem',
      height: '2.5rem',
      marginTop: '15.8rem',
      marginLeft: '1.3rem'
    },
    [`@media (min-width: 1131px)`]: {
      position: 'absolute',
      marginTop: '19rem',
      marginLeft: '-8.5rem',
      zIndex: 1,
    },
  },

  pointContainer: {
    display: 'flex',
    marginTop: '0.5rem',
    marginLeft: '0.5rem',
    [`@media (min-width: 968px)`]: {
    marginTop: '1rem',
    marginLeft: '1.4rem'
    },
    [`@media (min-width: 1131px)`]: {
      position: 'absolute',
      marginTop: '22.6rem',
      marginLeft: '-13rem'
    },
  },

  pointgroup: {
    // The pointgroup is hidden on mobile and tablet but becomes visible on desktop layouts.
    display: 'none',
    [`@media (min-width: 1131px)`]: {
      display: 'block',
      marginTop: '4rem',
      marginLeft: '-0.2rem'
  },
},

  point6: {
    marginLeft: '0.9rem',
    marginTop: '0.9rem',
    [`@media (min-width: 968px)`]: {
      width: '0.43rem',
      height: 'auto',
      marginLeft: '0.4rem'
    },
    [`@media (min-width: 1131px)`]: {
      marginTop: '0rem',
      marginLeft: '0.4rem'
    },
  },

  point8: {
    marginLeft: '0.2rem',
    marginTop: '0.4rem',
    [`@media (min-width: 968px)`]: {
      width: '0.43rem',
      height: 'auto',
      marginLeft: '0.4rem'
    },
    [`@media (min-width: 1131px)`]: {
      marginTop: '-0.1rem',
      marginLeft: '0.6rem'
    },
  },

  point10: {
    marginLeft: '0.2rem',
    [`@media (min-width: 968px)`]: {
      width: '0.43rem',
      height: 'auto',
    },
    [`@media (min-width: 1131px)`]: {
      marginLeft: '0.3rem'
    },
  },

  square: {
    width: '20rem',
    height: '20rem',
    marginTop: '6.6rem',
    marginLeft: '0.6rem',
    backgroundColor: '#1EAEFF',
    borderRadius: '6%',
    zIndex: 0,
    [`@media (min-width: 968px)`]: {
      width: '37.6rem',
      height: '40.5rem',
      marginTop: '-10.6rem',
      marginLeft: '-1.4rem',
    },
  },

  bigScreen: {
    width: '18.5rem',
    height: 'auto',
    marginTop: '-2.8rem',
    marginLeft: '1.2rem',
    zIndex: 1,
    borderRadius: '0.6rem',
    [`@media (min-width: 968px)`]: {
      width: '31.6rem',
      marginTop: '-4.4rem',
      marginLeft: '2.1rem'
    },
    [`@media (min-width: 1131px)`]: {
      width: '39.4rem',
      height: '27.5rem',
      marginTop: '-3.7rem',
      marginLeft: '-5.7rem'
    },
  },

  smallScreen: {
    width: '9.3rem',
    height: 'auto',
    marginTop: '-6rem',
    marginLeft: '11.5rem',
    zIndex: 100,
    borderRadius: '0.6rem',
    [`@media (min-width: 968px)`]: {
      width: '15.6rem',
      marginTop: '-11.1rem',
      marginLeft: '19.7rem',
      borderRadius: '1.5rem',
    },
    [`@media (min-width: 1131px)`]: {
      marginTop: '-16.4rem',
      marginLeft: '19.8rem'
    },
  },

  waves: {
    // The waves is hidden on mobile but becomes visible on tablet and desktop layouts.
    display: 'none',
    [`@media (min-width: 968px)`]: {
      display: 'flex',
      position: 'relative',
      marginTop: '-7.4rem',
      marginLeft: '4.5rem',
      opacity: '0.2',
      zIndex: -1,
    },
  },

  hexagon: {
    // The hexagon is hidden on mobile but becomes visible on tablet and desktop layouts.
    display: 'none',
    [`@media (min-width: 968px)`]: {
    display: 'block',
    position: 'relative',
    marginTop: '-12rem',
    marginLeft: '29rem',
    zIndex: -1,
    },
  },

  triangle: {
   // The triangle is hidden on mobile but becomes visible on tablet and desktop layouts. 
    display: 'none',
    [`@media (min-width: 968px)`]: {
    display: 'block',
    marginTop: '-32.8rem',
    marginLeft: '35.1rem',
    },
    [`@media (min-width: 1131px)`]: {
      marginTop: '-32.9rem',
      marginLeft: '35.2rem'
    },
  },
};
