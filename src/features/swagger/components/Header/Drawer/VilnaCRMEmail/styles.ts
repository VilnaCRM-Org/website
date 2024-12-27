import colorTheme from '@/components/UiColorTheme';
import { inter } from '@/config/Fonts/inter';

export default {
  emailWrapper: {
    border: `1px solid ${colorTheme.palette.brandGray.main}`,
    py: '1.125rem',
    borderRadius: '0.5rem',
    mt: '0.375rem',
    maxHeight: '4rem',
    mb: '1rem',
  },

  at: {
    fontSize: '1.375rem',
    fontFamily: inter.style.fontFamily,
  },

  emailText: {
    color: colorTheme.palette.darkSecondary.main,
  },
};
