import colorTheme from '@/components/UiColorTheme';
import { golos } from '@/config/Fonts/golos';

import { BREAKPOINTS, DIMENSIONS, Z_INDICES } from './constants';

export default {
  notificationSection: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    border: `1px solid ${colorTheme.palette.grey500.main}`,
    backgroundColor: colorTheme.palette.white.main,
    borderRadius: '2rem 2rem 0 0',
    boxShadow: '1px 1px 41px 0px rgba(59, 68, 80, 0.05)',
    overflow: 'hidden',

    maxHeight: '40.438rem',
    maxWidth: '31.375rem',

    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: Z_INDICES.NOTIFICATION_SECTION,

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
    zIndex: Z_INDICES.SUCCESS_BOX,
  },

  successTopImgBox: {
    position: 'absolute',
    top: '-0.78rem',
    left: '-8.5rem',
    zIndex: Z_INDICES.GEARS,

    [`@media (max-width: ${BREAKPOINTS.SM})`]: {
      transform: 'scale(0.91)',
    },

    [`@media (min-width: 641px)`]: {
      top: '0.6rem',
      left: '0rem',
      transform: 'scale(1.07)',
    },
    [`@media (min-width: 1131px)`]: {
      left: '-7rem',
      top: '0rem',
      transform: 'scale(1)',
    },
  },
  bottomImgBox: {
    position: 'absolute',
    bottom: '-0.78rem',
    left: '-11.8rem',
    zIndex: Z_INDICES.BOTTOM_IMG_BOX,
    transform: 'rotate(-180deg)',

    [`@media (max-width: ${BREAKPOINTS.SM})`]: {
      transform: 'rotate(-180deg) scale(0.91)',
    },

    [`@media (min-width: 641px)`]: {
      left: '0rem',
      bottom: '0.6rem',
      transform: 'rotate(-180deg) scale(1.07)',
    },

    [`@media (min-width: ${BREAKPOINTS.LG})`]: {
      left: '1.3rem',
    },
    [`@media (min-width: 1131px)`]: {
      left: '0rem',
      bottom: '0.1rem',
      transform: 'rotate(-180deg) scale(1)',
    },
  },

  imgWrapper: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    top: '2rem',

    [`@media (min-width: ${BREAKPOINTS.MD})`]: {
      top: '3rem',
    },
  },
  gears: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    top: '2rem',
    zIndex: Z_INDICES.GEARS,

    [`@media (max-width: ${BREAKPOINTS.SM})`]: {
      transform: 'translateX(-50%) scale(0.8)',
    },
    [`@media (min-width: ${BREAKPOINTS.MD})`]: {
      top: '3rem',
    },
  },

  messageContainer: {
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
    alignItems: 'center',
    background: `${colorTheme.palette.white.main}`,
    zIndex: Z_INDICES.MESSAGE_CONTAINER,

    [`@media (min-width: ${BREAKPOINTS.LG})`]: {
      width: '100%',
    },
  },

  messageTitle: {
    fontWeight: 700,
    fontSize: '1.375rem',
    lineHeight: '1.65rem',
    fontFamily: golos.style.fontFamily,
    color: colorTheme.palette.darkPrimary.main,
    zIndex: Z_INDICES.MESSAGE_TITLE,

    [`@media (min-width: 641px)`]: {
      fontWeight: 600,
      fontSize: '1.875rem',
      lineHeight: '2.25rem',
    },
  },

  messageDescription: {
    textAlign: 'center',
    marginTop: '0.5rem',
    fontWeight: 400,
    fontSize: '0.98rem',
    lineHeight: '1.5625rem',
    fontFamily: golos.style.fontFamily,
    color: colorTheme.palette.darkPrimary.main,

    [`@media (min-width: ${BREAKPOINTS.SM})`]: {
      fontSize: '1.2rem',
      lineHeight: '1.625rem',
    },
  },

  messageButton: {
    minWidth: '260px',
    width: '100%',
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
    fontWeight: 500,
    fontSize: '0.9375rem',
    lineHeight: '1.125rem',
    fontFamily: golos.style.fontFamily,

    [`@media (min-width: ${BREAKPOINTS.SM})`]: {
      fontWeight: 600,
      fontSize: '1.125rem',
      lineHeight: '1.35rem',
    },
  },

  // error notification
  contentBoxError: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '3.0625rem',
    [`@media (min-width: ${BREAKPOINTS.MD})`]: {
      paddingTop: '4.25rem',
    },
    [`@media (min-width: ${BREAKPOINTS.LG})`]: {
      paddingTop: '4.25rem',
    },
  },
  imageWrapperError: {
    marginBottom: '0.8125rem',

    [`@media (min-width: ${BREAKPOINTS.SM})`]: {
      marginBottom: '0.75rem',
    },
  },
  messageContainerError: {
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
    alignItems: 'center',
  },

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
    minWidth: '260px',
    width: '100%',
    height: '50px',
    paddingTop: '1rem',
    paddingBottom: '1rem',
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
      fontWeight: 600,
      fontSize: '18px',
      lineHeight: '21.6px',
    },
  },
};
