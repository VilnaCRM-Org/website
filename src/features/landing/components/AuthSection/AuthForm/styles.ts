import { CSSProperties } from 'react';

import breakpointsTheme from '@/components/UiBreakpoints';
import colorTheme from '@/components/UiColorTheme';

import Imagess from '../../../assets/svg/auth-section/bg.svg';
import Images from '../../../assets/svg/auth-section/image.svg';

export default {
  formWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    marginTop: '4.063rem',
    [`@media (max-width: 1130px)`]: {
      marginTop: '3.875rem',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      marginTop: '2.125rem',
    },
  },

  backgroundBlock: {
    position: 'absolute',
    minHeight: '18.75rem',
    borderRadius: '0.75rem 0.75rem 0 0',
    top: '16.2%',
    right: '5%',
    width: '31.25rem',
    maxHeight: ' 33.875rem',
    height: '33.875rem',
    aspectRatio: '312 / 339',
    backgroundColor: colorTheme.palette.brandGray.main,
    [`@media (max-width: 1130px)`]: {
      height: ' 39.313rem',
      top: '8.3%',
      right: '26%',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      top: '6.8%',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      display: 'none',
    },
  },

  loader: {
    position: 'absolute' as CSSProperties['position'],
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    inset: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(255,255, 255, 0.6)',
    borderRadius: '2rem 2rem 0 0',
  },

  formTitle: {
    paddingBottom: '2rem',
    minHeight: '3.5rem',
    lineHeight: '1.3',
    [`@media (max-width: 1130px)`]: {
      maxWidth: '22.313rem',
      paddingBottom: '1.25rem',
      minHeight: '2.5rem',
    },

    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      maxWidth: '15.313rem',
      fontSize: '1.375rem',
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: '1.4',
      paddingBottom: '1.188rem',
    },
  },

  formContent: {
    minHeight: '40.438rem',
    height: 'auto',
    overflow: 'hidden',
    contain: 'content',
    position: 'relative',
    zIndex: '5',
    padding: '2.25rem 2.5rem 2.5rem 2.5rem',
    borderRadius: '2rem 2rem 0 0',
    border: `1px solid  ${colorTheme.palette.brandGray.main}`,
    background: colorTheme.palette.white.main,
    maxWidth: '31.375rem',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: '1px 1px 41px 0px rgba(59, 68, 80, 0.05)',
    [`@media (max-width: 1130px)`]: {
      padding: '2.5rem 2.563rem 3.5rem 2.563rem',
      minWidth: '39.75rem',
      maxHeight: '42.875rem',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      minHeight: '100%',
      minWidth: '100%',
      maxWidth: '21.563rem',
      maxHeight: '512px',
      padding: '1.5rem 1.5rem 2rem 1.5rem',
    },
  },

  inputsWrapper: {
    flexDirection: 'column',
    gap: '1.375rem',
    [`@media (max-width: 1130px)`]: {
      gap: '0.9375rem',
    },
  },

  inputWrapper: {
    flexDirection: 'column',
    gap: '0.563rem',
    position: 'relative',
    minHeight: '5rem',
    contain: 'style',
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      gap: '0.313rem',
      minHeight: '4.5rem',
    },
  },

  inputTitle: {
    minHeight: '0.5rem',
    lineHeight: '1.3',
    [`@media (max-width: 1130px)`]: {
      fontSize: '1rem',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      fontSize: '0.875rem',
    },
  },

  buttonWrapper: {
    maxWidth: '10.938rem',
    height: '4.375rem',
    width: '100%',
    [`@media (max-width: 1130px)`]: {
      height: '4.375rem',
      maxWidth: '100%',
    },

    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      height: '3.125rem',
      maxWidth: '100%',
    },
  },

  labelText: {
    marginTop: '1.25rem',
    marginBottom: '2rem',
    mx: '0',
    minHeight: '3rem',
    [`@media (max-width: 1130px)`]: {
      marginBottom: '1.5rem',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      marginBottom: '1.188rem',
    },
  },

  tip: {
    cursor: 'pointer',
    lineHeight: '0',
  },

  button: {
    height: '3.5rem', 
    minHeight: '3.5rem', 
    width: '100%',
    padding: '0.75rem 1.5rem',
  },

  privacyText: {
    letterSpacing: '0rem',
    minHeight: '2.5rem',
    lineHeight: '1.2',
    [`@media (max-width: 1130px)`]: {
      fontSize: '1rem',
      maxWidth: '25.813rem',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      fontSize: '0.875rem',
    },
  },

  backgroundImage: {
    willChange: 'transform',
    backgroundImage: `url(${Images.src})`,
    width: '49rem',
    maxWidth: '49rem',
    height: '41rem',
    position: 'absolute',
    left: '-40%',
    bottom: '0%',
    zIndex: '1',
    aspectRatio: '49 / 41',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    [`@media (max-width: 1130px)`]: {
      backgroundImage: `url(${Imagess.src})`,
      left: '-12%',
      bottom: '16.5%',
      width: '50.938rem',
      aspectRatio: '509 / 345',
      height: '34.5rem',
    },

    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      display: 'none',
    },
  },

  errorText: {
    top: '100%',
    position: 'absolute',
    color: colorTheme.palette.error.main,
    minHeight: '1.25rem', 
    lineHeight: '1.2',
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      fontSize: '0.75rem',
    },
  },
};
