import breakpointsTheme from '@/components/UiBreakpoints';
import colorTheme from '@/components/UiColorTheme';
import { golos } from '@/config/Fonts/golos';

export default {
  notificationSection: {
    display: 'flex',
    position: 'absolute',
    zIndex: 100,
  },

  notificationWrapper: {
    minWidth: '21.57rem',
    width: '100%',
    height: '100%',
    borderRadius: '2rem 2rem 0 0',
    border: `1px solid ${colorTheme.palette.grey500.main} `,
    backgroundColor: colorTheme.palette.white.main,
    overflow: 'hidden',

    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      minHeight: '32rem',
    },

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      minWidth: '39.8rem',
      minHeight: '42.2rem',
    },

    [`@media (min-width: 769px) and (max-width:  ${breakpointsTheme.breakpoints.values.lg}px)`]: {
      minWidth: '39.7rem',
      minHeight: '42.9rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.lg}px)`]: {
      minWidth: '39.7rem',
      minHeight: '42.8rem',
    },
    [`@media (min-width: 1131px)`]: {
      minWidth: '31.4rem',
      minHeight: '40.45rem',
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

    top: '-0.78rem',
    left: '-8.5rem',
    transform: 'scale(0.91)',

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      minWidth: '29rem',
      top: '0.25rem',
      left: '0.6rem',
      transform: 'scale(1.04)',
    },
  },
  bottomImgBox: {
    display: 'none',
    rotate: '-180deg',

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      display: 'block',
      minWidth: '29rem',
      top: '25.7rem',
      left: '0.6rem',
      transform: 'scale(1.04)',
    },

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      top: '26.5rem',
    },

    [`@media (min-width: ${breakpointsTheme.breakpoints.values.lg}px)`]: {
      top: '24rem',
      left: '-6.5rem',
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
