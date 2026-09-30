import { ThemeProvider } from '@mui/material';
import { render, RenderResult, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import React from 'react';

import { UiToolbar } from '@/components';
import { theme } from '@/components/app-theme';
import HeaderPlaceholder from '@/components/header-placeholder';
import { expectNoA11yViolations } from '@/test/a11y/expect-no-a11y-violations';

function renderThemed(ui: React.ReactElement): RenderResult {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('HeaderPlaceholder', () => {
  it('reserves exactly the height of the header toolbar it stands in for', () => {
    const { container } = renderThemed(
      <>
        <HeaderPlaceholder />
        <UiToolbar>
          <span>Toolbar</span>
        </UiToolbar>
      </>
    );
    const [placeholder, toolbar] = Array.from(container.children);

    expect(placeholder).toHaveStyle({ minHeight: `${theme.mixins.toolbar.minHeight}px` });
    expect(getComputedStyle(placeholder!).minHeight).toBe(getComputedStyle(toolbar!).minHeight);
  });

  it('adds no landmark, no text and no tab stop', async () => {
    const user: UserEvent = userEvent.setup();
    const { container } = renderThemed(<HeaderPlaceholder />);

    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(container.firstElementChild).toBeEmptyDOMElement();
    await user.tab();
    expect(document.body).toHaveFocus();
    await expectNoA11yViolations(container);
  });
});
