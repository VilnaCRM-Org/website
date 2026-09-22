import colorTheme from '../ui-color-theme';

export default {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5rem',
    minHeight: '60vh',
    padding: '4rem 1.5rem',
    textAlign: 'center',
  },
  title: {
    fontWeight: 700,
    color: colorTheme.palette.darkPrimary.main,
  },
  description: {
    color: colorTheme.palette.grey250.main,
    maxWidth: '32rem',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    justifyContent: 'center',
  },
};
