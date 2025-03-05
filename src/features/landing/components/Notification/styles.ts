import colorTheme from '@/components/UiColorTheme';
import { golos } from '@/config/Fonts/golos';

import { BREAKPOINTS, DIMENSIONS } from './constants';

export default {
  notificationSection: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '2rem 2rem 0 0',
    border: `1px solid ${colorTheme.palette.grey500.main} `,
    backgroundColor: colorTheme.palette.white.main,
    overflow: 'hidden',
    zIndex: 100,

    [`@media (max-width: ${BREAKPOINTS.SM})`]: {
      maxWidth: DIMENSIONS.MIN_WIDTH.XS,
      minHeight: DIMENSIONS.MIN_HEIGHT.XS,
    },

    [`@media (min-width: 641px)`]: {
      minWidth: DIMENSIONS.MIN_WIDTH.SM,
      minHeight: DIMENSIONS.MIN_HEIGHT.SM,
    },

    [`@media (min-width: 769px) and (max-width: ${BREAKPOINTS.LG})`]: {
      minWidth: DIMENSIONS.MIN_WIDTH.MD,
      minHeight: DIMENSIONS.MIN_HEIGHT.MD,
    },

    [`@media (min-width: ${BREAKPOINTS.LG})`]: {
      minWidth: DIMENSIONS.MIN_WIDTH.MD,
      minHeight: DIMENSIONS.MIN_HEIGHT.MD,
    },
    [`@media (min-width: 1131px)`]: {
      minWidth: DIMENSIONS.MIN_WIDTH.LG,
      minHeight: DIMENSIONS.MIN_HEIGHT.LG,
    },
  },

  // success box
  contentBox: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    paddingTop: '4.4rem',

    [`@media (min-width: ${BREAKPOINTS.MD})`]: {
      paddingTop: '3.5rem',
    },

    [`@media (min-width: ${BREAKPOINTS.LG})`]: {
      paddingTop: '3.2rem',
    },
  },

  contentBoxError: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: '3.0625rem',

    [`@media (min-width: ${BREAKPOINTS.MD})`]: {
      paddingTop: '4.25rem',
    },
    [`@media (min-width: ${BREAKPOINTS.LG})`]: {
      paddingTop: '4.25rem',
    },
  },

  successImgBox: {
    position: 'absolute',

    top: '-0.78rem',
    left: '-8.5rem',
    transform: 'scale(0.91)',

    [`@media (min-width: ${BREAKPOINTS.SM})`]: {
      minWidth: '29rem',
      top: '0.25rem',
      left: '0.6rem',
      transform: 'scale(1.04)',
    },
  },
  bottomImgBox: {
    position: 'absolute',
    rotate: '-180deg',
    minWidth: '29rem',
    left: '0rem',
    top: '24.7rem',


    [`@media (min-width: ${BREAKPOINTS.SM})`]: {
      minWidth: '29rem',
      transform: 'scale(1.04)',
      left: '0.6rem',
      top: '25.7rem',
    },
    [`@media (min-width: ${BREAKPOINTS.MD})`]: {
      top: '26.5rem',
    },

    [`@media (min-width: ${BREAKPOINTS.LG})`]: {
      minWidth: '31rem',
      top: '27rem',
      left: '0.4rem',
    },
    [`@media (min-width: ${BREAKPOINTS.XL})`]: {
      top: '24.5rem',
      transform: 'scale(1)',
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

    [`@media (min-width: ${BREAKPOINTS.MD})`]: {
      marginTop: '0.3rem',
    },

    [`@media (min-width: ${BREAKPOINTS.LG})`]: {
      marginTop: '0.6rem',
    },
  },

  messageContainerError: {
    marginTop: '0.8125rem',

    [`@media (min-width: ${BREAKPOINTS.MD})`]: {
      marginTop: '0.75rem',
    },

    [`@media (min-width: ${BREAKPOINTS.LG})`]: {
      marginTop: '0.75rem',
    },
  },

  messageTitle: {
    fontWeight: 700,
    fontSize: '22px',
    lineHeight: '26.4px',
    fontFamily: golos.style.fontFamily,
    color: colorTheme.palette.darkPrimary.main,

    [`@media (min-width: ${BREAKPOINTS.MD})`]: {
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

    [`@media (min-width: ${BREAKPOINTS.MD})`]: {
      fontSize: '16px',
      lineHeight: '26px',
    },
  },

  messageButton: {
    minWidth: '260px',
    width:'100%',
    marginTop: '1rem',

    [`@media (min-width: ${BREAKPOINTS.XS})`]: {
      minWidth: '301px',
    },
    [`@media (min-width: ${BREAKPOINTS.MD})`]: {
      marginTop: '1.5rem',
      maxWidth: '266px',
    },
    [`@media (min-width: ${BREAKPOINTS.LG})`]: {
      maxWidth: '242px',
    },
  },
  messageButtonText: {
    fontWeight: '500',
    fontSize: '15px',
    lineHeight: '18px',
    fontFamily: golos.style.fontFamily,

    [`@media (min-width: ${BREAKPOINTS.MD})`]: {
      fontWeight: '600',
      fontSize: '18px',
      lineHeight: '21.6px',
    },
  },

  // error notification
  buttonsBox: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    marginTop: '1rem',

    [`@media (min-width: ${BREAKPOINTS.SM})`]: {
      marginTop: '2rem',
    },
    [`@media (min-width: ${BREAKPOINTS.LG})`]: {
      marginTop: '1rem',
    },
  },

  errorButton: {
    height: '50px',
    paddingY: '1rem',
    borderRadius: '3.5625rem',
    boxShadow: 'none',

    [`@media (min-width: ${BREAKPOINTS.XS})`]: {
      minWidth: '301px',
    },
    [`@media (min-width: ${BREAKPOINTS.SM})`]: {
      width: '315px',
      height: '70px',
    },
    [`@media (min-width: ${BREAKPOINTS.XL})`]: {
      width: '291px',
      height: '62px',
    },
  },
  errorButtonMessage: {
    [`@media (min-width: ${BREAKPOINTS.SM})`]: {
      fontWeight: '600',
      fontSize: '18px',
      lineHeight: '21.6px',
    },
  },
};
