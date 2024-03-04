import breakpointsTheme from '@/components/UiBreakpoints';

export default {
  text: {
    pt: '0.25rem',
    pb: '1.375rem',
  },
  listWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '1.875rem',
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      gap: '1rem',
    },
  },
};
