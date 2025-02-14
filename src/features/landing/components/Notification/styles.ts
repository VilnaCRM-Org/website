import breakpointsTheme from '@/components/UiBreakpoints';
import colorTheme from '@/components/UiColorTheme';
import { golos } from '@/config/Fonts/golos';

export default {
  notificationSection: {
    display: 'flex',
    paddingTop: '4.063rem',

    [`@media (max-width: 1130px)`]: {
      paddingTop: '3.875rem',
      paddingBottom: '3.5rem',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      paddingTop: '2.125rem',
    },
  },

  isVisible: {
    opacity: 1,
    transform: 'scale(1)',
    transition:
      'opacity 400ms cubic-bezier(.17,.67,.83,.67), transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
  },

  isHidden: {
    opacity: 0,
    position: 'absolute',
    pointerEvents: 'none',
    visibility: 'hidden',
    transform: 'scale(0.3)',
    transition:
      'opacity 400ms cubic-bezier(.17,.67,.83,.67), transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
  },

  notificationWrapper: {
    minWidth: '21.57rem',
    width: '100%',
    height: '100%',
    borderRadius: '1rem',
    border: `1px solid ${colorTheme.palette.grey500.main} `,
    backgroundColor: colorTheme.palette.white.main,
    overflow: 'hidden',

    [`@media (max-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      paddingBottom: '1.67rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      minWidth: '39.8rem',
      minHeight: '40.438rem',
      paddingBottom: '1.5rem',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      paddingBottom: '1.5rem',
    },

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.lg}px)`]: {
      minWidth: '31.375rem',
      minHeight: '40.438rem',
    },
  },

  // success box
  successBox: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    paddingTop: '4.4rem',

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      paddingTop: '3.5rem',
    },

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.lg}px)`]: {
      paddingTop: '3.2rem',
    },
  },

  successImgBox: {
    position: 'absolute',

    // mobile
    top: '-0.78rem',
    left: '-8.5rem',
    scale: 0.91,

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      minWidth: '29rem',
      top: '0.25rem',
      left: '0.6rem',
      scale: '1.04',
    },
  },
  bottomImgBox: {
    display: 'none',
    rotate: '-180deg',

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px) and (max-width: ${breakpointsTheme.breakpoints.values.lg}px)`]:
      {
        display: 'block',
        minWidth: '29rem',
        top: '25rem',
        left: '0.6rem',

        transform: 'scaleX(1.14)',
      },

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.lg}px)`]: {
      display: 'block',
      top: '26.6rem',
      left: '-2.4rem',
      scale: 0.98,
    },
  },

  imgWrapper: {
    zIndex: 3,
  },
  messageContainer: {
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '1.39rem',
    zIndex: 3,

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      marginTop: '0.3rem',
    },

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.lg}px)`]: {
      marginTop: '0.6rem',
    },
  },

  messageTitle: {
    fontWeight: 700,
    fontSize: '22px',
    lineHeight: '26.4px',
    fontFamily: golos.style.fontFamily,
    color: colorTheme.palette.darkPrimary.main,

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      fontWeight: 600,
      fontSize: '30px',
      lineHeight: '36px',
    },
  },

  messageDescription: {
    mt: '0.5rem',
    fontWeight: 400,
    fontSize: '15px',
    lineHeight: '25px',
    fontFamily: golos.style.fontFamily,
    color: colorTheme.palette.darkPrimary.main,

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      fontSize: '16px',
      lineHeight: '26px',
    },
  },

  messageButton: {
    minWidth: '301px',
    marginTop: '1rem',

    fontWeight: '500 !important',
    fontSize: '15px',
    lineHeight: '18px',
    fontFamily: golos.style.fontFamily,

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      marginTop: '1.5rem',
      maxWidth: '266px',
      fontWeight: '600 !important',
      fontSize: '18px',
      lineHeight: '21.6px',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.lg}px)`]: {
      maxWidth: '242px',
    },
  },
};
