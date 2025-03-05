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
      marginLeft: '38.2rem'
    },
  },

  svgContainer: {
    // The container has elements inside, but no styles are needed except for the tablet layout.
    [`@media (min-width: 969px)`]: {
      marginTop: '-15rem',
    },
  },

  circle: {
    width: '0.5rem',
    height: '0.5rem',
    marginTop: '5.1rem',
    marginLeft: '1.5rem',
    [`@media (min-width: 468px)`]: {
    position: 'absolute',
    },
   [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: '0.6rem',
      height: '0.6rem',
      marginTop: '4.7rem',
      marginLeft: '1rem'
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '0.8rem',
      height: '0.8rem',
      marginTop: '2.9rem',
      marginLeft: '1.5rem'
    },
    [`@media (min-width: 969px)`]: {
      marginTop: '2rem',
      marginLeft: '2rem',
    },
    [`@media (min-width: 1131px)`]: {
    marginTop: '1.9rem',
    marginLeft: '-9.4rem'
    },
  },

  rhombus: {
    width: '1.5rem',
    height: '1.5rem',
    marginTop: '9.1rem',
    marginLeft: '1.1rem',
    [`@media (min-width: 468px)`]: {
      position: 'absolute',
      marginTop: '15rem'
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: '2rem',
      height: '2rem',
      marginTop: '16rem',
      marginLeft: '0.5rem'
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '2.5rem',
      height: '2.5rem',
      marginTop: '18.5rem',
      marginLeft: '0.7rem'
    },
    [`@media (min-width: 969px)`]: {
      marginTop: '18.9rem',
      marginLeft: '1.3rem'
    },
    [`@media (min-width: 1131px)`]: {
      marginTop: '19rem',
      marginLeft: '-8.5rem',
      zIndex: 1,
    },
  },

  pointContainer: {
    display: 'flex',
    marginTop: '0.5rem',
    marginLeft: '0.5rem',
    [`@media (min-width: 468px)`]: {
      marginTop: '17rem'
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      marginTop: '19rem',
      marginLeft: '0.2rem',
    },
    [`@media (min-width: 641px)`]: {
     marginLeft: '0rem'
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      marginTop: '22rem',
      marginLeft: '1.5rem'
    },
    [`@media (min-width: 969px)`]: {
      marginTop: '22.4rem',
      marginLeft: '1.4rem'
    },
    [`@media (min-width: 1131px)`]: {
      position: 'absolute',
      marginTop: '22.6rem',
      marginLeft: '-13rem'
    },
  },

  pointGroup: {
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
    marginTop: '1rem',
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: '0.40rem',
      height: 'auto',
      marginTop: '0rem'
    },
    [`@media (min-width: 641px)`]: {
      marginTop: '0.1rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '0.45rem',
      height: 'auto',
      marginTop: '0rem',
      marginLeft: '-0.2rem'
    },
    [`@media (min-width: 969px)`]: {
      width: '0.43rem',
      height: 'auto',
      marginLeft: '0.4rem',
      marginTop: '0.18rem',
    },
    [`@media (min-width: 1131px)`]: {
      marginTop: '0.23rem',
      marginLeft: '0.4rem'
    },
  },

  point8: {
    marginLeft: '0.2rem',
    marginTop: '0.55rem',
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: '0.40rem',
      height: 'auto',
      marginLeft: '0.3rem'
    },
    [`@media (min-width: 641px)`]: {
      marginTop: '0rem',
      marginLeft: '0.4rem'
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '0.45rem',
      height: 'auto',
      marginTop: '0rem'
    },
    [`@media (min-width: 969px)`]: {
      width: '0.43rem',
      height: 'auto',
      marginLeft: '0.38rem',
      marginTop: '0.15rem'
    },
    [`@media (min-width: 1131px)`]: {
      marginTop: '0.21rem',
      marginLeft: '0.5rem'
    },
  },

  point10: {
    marginLeft: '0.2rem',
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: '0.40rem',
      height: 'auto', 
      marginLeft: '0.2rem'
    },
    [`@media (min-width: 641px)`]: {
     marginLeft: '0.2rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '0.45rem',
      height: 'auto',
    },
    [`@media (min-width: 969px)`]: {
      width: '0.43rem',
      height: 'auto',
      marginTop: '0.2rem'
    },
    [`@media (min-width: 1131px)`]: {
      marginLeft: '0.3rem'
    },
  },

  square: {
    width: '35rem',
    height: '19.6rem',
    marginTop: '6.6rem',
    marginLeft: '0.6rem',
    backgroundColor: colorTheme.palette.primary.main,
    borderRadius: '6%',
    zIndex: 0,
    [`@media (min-width: 426px)`]: {
      width: '22rem',
      height: '20rem'
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: '26.5rem',
      height: '22rem'
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '38rem',
      height: '29.7rem',
      marginLeft: '1.5rem'
    },
    [`@media (min-width: 969px)`]: {
      width: '37.6rem',
      height: '40.5rem',
      marginTop: '-10.6rem',
      marginLeft: '1.2rem',
    },
    [`@media (min-width: 1131px)`]: {
      marginLeft: '-1.3rem'
    },
  },

  bigScreen: {
    width: '18.5rem',
    height: '12.8rem',
    marginTop: '-2.8rem',
    marginLeft: '1.2rem',
    zIndex: 1,
    borderRadius: '0.6rem',
    boxShadow: '0px 24px 48px rgba(0, 0, 0, 0.15), 0px 12px 24px rgba(0, 0, 0, 0.1)',
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
     width: '22rem',
     height: '16rem',
     marginTop: '-4.3rem'     
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '31.6rem',
      height: '20.5rem',
      marginTop: '-5rem',
      marginLeft: '1.5rem'
    },
    [`@media (min-width: 969px)`]: {
      width: '31.6rem',
      height: '21.7rem',
      marginTop: '-4.4rem',
      marginLeft: '2.1rem',
      boxShadow: '12px 24px 48px rgba(82, 87, 100, 0.25), 6px 12px 24px rgba(0, 0, 0, 0.15)',
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
    boxShadow: '0px 12px 24px rgba(0, 0, 0, 0.2), 0px 6px 12px rgba(0, 0, 0, 0.15)',
    [`@media (max-width: 320px)`]: {
      marginLeft: '7rem' 
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: '11rem',
      marginTop: '-7rem',
      marginLeft: '13.3rem'   
     },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '14rem',
      marginTop: '-10rem',
      marginLeft: '20.5rem'
    },
    [`@media (min-width: 969px)`]: {
      width: '15.6rem',
      marginTop: '-9.7rem',
      marginLeft: '19.7rem',
      borderRadius: '1.5rem',
      boxShadow: '6px 12px 36px rgba(82, 87, 100, 0.3), 3px 6px 18px rgba(0, 0, 0, 0.15)',
    },
    [`@media (min-width: 1131px)`]: {
      width: '15.7rem',
      marginTop: '-16.4rem',
      marginLeft: '19.7rem'
    },
  },

  waves: {
    // The waves is hidden on mobile but becomes visible on tablet and desktop layouts.
    display: 'none',
    [`@media (min-width: 426px)`]: {
      display: 'flex',
      position: 'relative',
      width: '10rem',
      height: '10rem',
      marginTop: '-9rem',
      marginLeft: '2.5rem',
      opacity: '0.2',
      zIndex: -1,
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: '12rem',
      height: '12rem',
      marginTop: '-10.5rem',
      marginLeft: '2.1rem',
      },
    [`@media (min-width: 641px)`]: {
      marginTop: '-11.1rem',
      marginLeft: '2.5rem',
    },
    [`@media (min-width: 768px)`]: {
      width: 'auto',
      height: 'auto',
      marginTop: '-7.5rem',
      marginLeft: '4.5rem',
    },
  },

  hexagon: {
    // The hexagon is hidden on mobile but becomes visible on tablet and desktop layouts.
    display: 'none',
    [`@media (min-width: 426px)`]: {
      display: 'block',
      position: 'relative',
      width: '10rem',
      height: '7rem',
      marginTop: '-8rem',
      marginLeft: '15rem',
      zIndex: -1,
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: 'auto',
      height: 'auto',
      marginTop: '-11.9rem',
      marginLeft: '16.8rem',
    },
    [`@media (min-width: 768px)`]: {
      marginLeft: '29rem',
      },
  },

  triangle: {
    // The triangle is hidden on mobile but becomes visible on tablet and desktop layouts.
     display: 'none',
     [`@media (min-width: 426px)`]: {
      display: 'block',
      width: '1.7rem',
      height: '1.7rem',
      marginTop: '-21.8rem',
      marginLeft: '20rem',
     },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: 'auto',
      height: 'auto',
      marginTop: '-25.5rem',
      marginLeft: '23.5rem',
    },
     [`@media (min-width: 768px)`]: {
       marginTop: '-29rem',
       marginLeft: '34.5rem',
     },
     [`@media (min-width: 969px)`]: {
       marginTop: '-32.9rem',
     },
     [`@media (min-width: 1131px)`]: {
       marginTop: '-33rem',
     },
   },
 }; 
