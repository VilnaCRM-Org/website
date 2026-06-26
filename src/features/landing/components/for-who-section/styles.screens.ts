import breakpointsTheme from '@/components/ui-breakpoints';

export default {
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
      marginTop: '-4.3rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '31.6rem',
      height: '20.5rem',
      marginTop: '-5rem',
      marginLeft: '1.5rem',
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
      marginLeft: '-5.7rem',
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
      marginLeft: '7rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      width: '11rem',
      marginTop: '-7rem',
      marginLeft: '13.3rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      width: '14rem',
      marginTop: '-10rem',
      marginLeft: '20.5rem',
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
      marginLeft: '19.7rem',
    },
  },

  waves: {
    // The waves is hidden on mobile but becomes visible on tablet and desktop layouts.
    visibility: 'hidden',
    [`@media (min-width: 426px)`]: {
      display: 'flex',
      visibility: 'visible',
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
    visibility: 'hidden',
    [`@media (min-width: 426px)`]: {
      display: 'block',
      visibility: 'visible',
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
