import breakpointsTheme from '@/components/ui-breakpoints';
import colorTheme from '@/components/ui-color-theme';

export default {
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
      marginLeft: '1rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '0.8rem',
      height: '0.8rem',
      marginTop: '2.9rem',
      marginLeft: '1.5rem',
    },
    [`@media (min-width: 969px)`]: {
      marginTop: '2rem',
      marginLeft: '2rem',
    },
    [`@media (min-width: 1131px)`]: {
      marginTop: '1.9rem',
      marginLeft: '-9.4rem',
    },
  },

  rhombus: {
    width: '1.5rem',
    height: '1.5rem',
    marginTop: '9.1rem',
    marginLeft: '1.1rem',
    [`@media (min-width: 468px)`]: {
      position: 'absolute',
      marginTop: '15rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: '2rem',
      height: '2rem',
      marginTop: '16rem',
      marginLeft: '0.5rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '2.5rem',
      height: '2.5rem',
      marginTop: '18.5rem',
      marginLeft: '0.7rem',
    },
    [`@media (min-width: 969px)`]: {
      marginTop: '18.9rem',
      marginLeft: '1.3rem',
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
      marginTop: '17rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      marginTop: '19rem',
      marginLeft: '0.2rem',
    },
    [`@media (min-width: 641px)`]: {
      marginLeft: '0rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      marginTop: '22rem',
      marginLeft: '1.5rem',
    },
    [`@media (min-width: 969px)`]: {
      marginTop: '22.4rem',
      marginLeft: '1.4rem',
    },
    [`@media (min-width: 1131px)`]: {
      position: 'absolute',
      marginTop: '22.6rem',
      marginLeft: '-13rem',
    },
  },

  pointGroup: {
    // The pointgroup is hidden on mobile and tablet but becomes visible on desktop layouts.
    display: 'none',
    [`@media (min-width: 1131px)`]: {
      display: 'block',
      marginTop: '4rem',
      marginLeft: '-0.2rem',
    },
  },

  point6: {
    marginLeft: '0.9rem',
    marginTop: '1rem',
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: '0.40rem',
      height: 'auto',
      marginTop: '0rem',
    },
    [`@media (min-width: 641px)`]: {
      marginTop: '0.1rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '0.45rem',
      height: 'auto',
      marginTop: '0rem',
      marginLeft: '-0.2rem',
    },
    [`@media (min-width: 969px)`]: {
      width: '0.43rem',
      height: 'auto',
      marginLeft: '0.4rem',
      marginTop: '0.18rem',
    },
    [`@media (min-width: 1131px)`]: {
      marginTop: '0.23rem',
      marginLeft: '0.4rem',
    },
  },

  point8: {
    marginLeft: '0.2rem',
    marginTop: '0.55rem',
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: '0.40rem',
      height: 'auto',
      marginLeft: '0.3rem',
    },
    [`@media (min-width: 641px)`]: {
      marginTop: '0rem',
      marginLeft: '0.4rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '0.45rem',
      height: 'auto',
      marginTop: '0rem',
    },
    [`@media (min-width: 969px)`]: {
      width: '0.43rem',
      height: 'auto',
      marginLeft: '0.38rem',
      marginTop: '0.15rem',
    },
    [`@media (min-width: 1131px)`]: {
      marginTop: '0.21rem',
      marginLeft: '0.5rem',
    },
  },

  point10: {
    marginLeft: '0.2rem',
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: '0.40rem',
      height: 'auto',
      marginLeft: '0.2rem',
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
      marginTop: '0.2rem',
    },
    [`@media (min-width: 1131px)`]: {
      marginLeft: '0.3rem',
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
      height: '20rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: '26.5rem',
      height: '22rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '38rem',
      height: '29.7rem',
      marginLeft: '1.5rem',
    },
    [`@media (min-width: 969px)`]: {
      width: '37.6rem',
      height: '40.5rem',
      marginTop: '-10.6rem',
      marginLeft: '1.2rem',
    },
    [`@media (min-width: 1131px)`]: {
      marginLeft: '-1.3rem',
    },
  },
};
