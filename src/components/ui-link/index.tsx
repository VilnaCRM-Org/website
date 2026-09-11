import { Link, ThemeProvider } from '@mui/material';

import { resolveExternalLinkRel } from '@/shared/externalLinkRel';

import { theme } from './theme';
import { UiLinkProps } from './types';

function UiLink({ children, href, target, rel }: UiLinkProps): React.ReactElement {
  return (
    <ThemeProvider theme={theme}>
      <Link href={href} target={target} rel={resolveExternalLinkRel(target, rel)}>
        {children}
      </Link>
    </ThemeProvider>
  );
}

export default UiLink;
