import colorTheme from '@/components/ui-color-theme';

export default {
  emailWrapper: {
    justifyContent: 'center',
    border: `1px solid ${colorTheme.palette.brandGray.main}`,
    py: '1.125rem',
    borderRadius: '0.5rem',
    mt: '0.375rem',
    maxHeight: '4rem',
    mb: '1rem',
  },

  emailRow: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.62rem',
  },

  emailText: {
    color: colorTheme.palette.darkSecondary.main,
  },
  at: {
    position: 'relative' as const,
    top: 1,
  },
};
