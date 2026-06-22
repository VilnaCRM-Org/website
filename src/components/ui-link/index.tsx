import { Link, ThemeProvider } from '@mui/material';

import { theme } from './theme';
import { UiLinkProps } from './types';

function UiLink({ children, href, target, rel }: UiLinkProps): React.ReactElement {
  return (
    <ThemeProvider theme={theme}>
      <Link href={href} target={target} rel={rel}>
        {children}
      </Link>
    </ThemeProvider>
  );
}

export default UiLink;
