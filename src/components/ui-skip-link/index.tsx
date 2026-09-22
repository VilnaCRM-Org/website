import { Link, ThemeProvider } from '@mui/material';

import { theme } from './theme';
import { UiSkipLinkProps } from './types';

function UiSkipLink({ label, targetId }: UiSkipLinkProps): React.ReactElement {
  return (
    <ThemeProvider theme={theme}>
      <Link href={`#${targetId}`}>{label}</Link>
    </ThemeProvider>
  );
}

export default UiSkipLink;
