import breakpointsTheme from '@/components/UiBreakpoints';
import colorTheme from '@/components/UiColorTheme';

export default {
  errorText: {
    position: 'absolute',
    bottom: '6rem',
    color: colorTheme.palette.error.main,
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      fontSize: '0.75rem',
      bottom: '5.2rem',
    },
    [`@media (min-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      bottom: '7.3rem',
    },
    [`@media (min-width: 1131px)`]: {
      bottom: '6.3rem',
    },
  },
};
