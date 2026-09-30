/**
 * Integration: the header placeholder `pages/_app.tsx` renders while the client-only
 * header chunk loads. It must resolve the app theme's toolbar mixin, the same rule the
 * header's MUI Toolbar applies, so swapping one for the other moves nothing below it.
 */
import { ThemeProvider } from '@mui/material';
import { render } from '@testing-library/react';

import { theme } from '@/components/app-theme';
import HeaderPlaceholder from '@/components/header-placeholder';

describe('integration: HeaderPlaceholder', () => {
  it('reserves the toolbar height of the app theme', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <HeaderPlaceholder />
      </ThemeProvider>
    );

    expect(container.firstElementChild).toHaveStyle({
      minHeight: `${theme.mixins.toolbar.minHeight}px`,
    });
    expect(container.firstElementChild).toBeEmptyDOMElement();
  });
});
