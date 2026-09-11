import colorTheme from '@/components/ui-color-theme';

const page: React.CSSProperties = {
  boxSizing: 'border-box',
  margin: '0 auto',
  maxWidth: '34rem',
  padding: '4rem 1.5rem',
  textAlign: 'center',
  color: colorTheme.palette.darkPrimary.main,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  lineHeight: 1.5,
};

const heading: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '1.75rem',
  fontWeight: 600,
};

const description: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '1rem',
};

const hint: React.CSSProperties = {
  margin: '0 0 2rem',
  fontSize: '0.9375rem',
  color: colorTheme.palette.grey250.main,
};

const link: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.75rem 1.5rem',
  borderRadius: '0.5rem',
  backgroundColor: colorTheme.palette.primary.main,
  color: colorTheme.palette.darkPrimary.main,
  fontSize: '1rem',
  fontWeight: 600,
  textDecoration: 'none',
};

export default { page, heading, description, hint, link };
