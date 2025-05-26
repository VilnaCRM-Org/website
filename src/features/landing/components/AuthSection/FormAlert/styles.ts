import breakpointsTheme from '@/components/UiBreakpoints';
import colorTheme from '@/components/UiColorTheme';

export default {
  errorText: {
    top: '100%',
    position: 'absolute',
    color: colorTheme.palette.error.main,
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      fontSize: '0.75rem',
    },
  },
};
