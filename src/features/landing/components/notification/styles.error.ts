import { BREAKPOINTS } from './constants';

export default {
  // error notification
  contentBoxError: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '1rem',

    [`@media (min-width: 641px)`]: {
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

    [`@media (min-width: 334px) and (max-width: ${BREAKPOINTS.SM})`]: {
      padding: '0rem 0.6rem',
    },
    [`@media (min-width: 1131px)`]: {
      padding: '0rem 1.2rem',
    },
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
