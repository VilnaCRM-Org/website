import breakpointsTheme from '@/components/UiBreakpoints';
import colorTheme from '@/components/UiColorTheme';

export default {
  wrapper: {
    position: 'relative',
  },

  notch: {
    bottom: '0.188rem',
    left: '0.063rem',
    height: '1.125rem',
    width: '5.875rem',
    margin: '0 auto',
    background: colorTheme.palette.darkPrimary.main,
    borderBottomLeftRadius: '0.375rem',
    borderBottomRightRadius: '0.375rem',
    zIndex: '11',
    '&:before': {
      content: '" "',
      position: 'absolute',
      top: '20%',
      left: '50%',
      height: '0.375rem',
      width: '0.375rem',
      border: '1px solid #101417',
      borderRadius: '100%',
      transform: 'translate(-50%,-50%)',
      backgroundColor: colorTheme.palette.notchDeskBefore.main,
    },
    '&:after': {
      content: '" "',
      position: 'absolute',
      top: '20%',
      left: '50%',
      height: '0.188rem',
      width: '0.188rem',
      backdropFilter: 'blur(0.313rem)',
      borderRadius: '100%',
      transform: 'translate(-50%,-50%)',
      backgroundColor: colorTheme.palette.notchDeskAfter.main,
    },

    [`@media (max-width: ${breakpointsTheme.breakpoints.values.lg}px)`]: {
      display: 'none',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      display: 'inline-block',
      position: 'relative',
      top: '0',
      left: '22%',
      background: colorTheme.palette.darkPrimary.main,
      height: '1.063rem',
      width: '6.75rem',
      margin: '0 auto',
      borderBottomLeftRadius: '1.625rem',
      borderBottomRightRadius: '1.625rem',
      zIndex: '11',
      '&:before': {
        content: '" "',
        position: 'absolute',
        top: '20%',
        left: '50%',
        width: '1.5rem',
        height: '0.25rem',
        borderRadius: '0.313rem',
        backgroundColor: colorTheme.palette.notchMobileBefore.main,
        transform: 'translate(-50%,-50%)',
      },
      '&:after': {
        content: '" "',
        position: 'absolute',
        top: '20%',
        left: '70%',
        width: '0.5rem',
        height: '0.5rem',
        borderRadius: '0.313rem',
        backgroundColor: colorTheme.palette.notchMobileAfter.main,
      },
    },
  },
};
