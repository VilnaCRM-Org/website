import breakpointsTheme from '../ui-breakpoints';
import colorTheme from '../ui-color-theme';

export default {
  errorText: {
    top: '100%',
    position: 'absolute',
    paddingBottom: '10px',
    color: colorTheme.palette.error.main,
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      fontSize: '0.75rem',
    },
  },
};
