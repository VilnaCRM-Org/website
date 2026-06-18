/**
 * Integration: UiTooltip WrapperUiTooltip.
 *
 * Renders the REAL `WrapperUiTooltip` with `useMediaQuery` mocked so we can
 * drive every branch: open/close on click (toggleTooltip both directions),
 * close-on-click-away, and the breakpoint-crossing reset that derives state
 * during render.
 */
import { ClickAwayListener } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';

import WrapperUiTooltip from '@/components/UiTooltip/TooltipWrapper';

const useMediaQueryMock: jest.Mock = jest.fn();

jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useMediaQuery: (query: string): boolean => useMediaQueryMock(query),
}));

const triggerText = 'Trigger';
const tooltipContent = 'Tooltip Text';
const tooltipRole = 'tooltip';

describe('WrapperUiTooltip', () => {
  beforeEach(() => {
    // Default: max-width matches, min-width does not.
    useMediaQueryMock.mockImplementation((query: string) => query.includes('max-width'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the trigger and toggles the tooltip open then closed on click', () => {
    render(<WrapperUiTooltip title={tooltipContent}>{triggerText}</WrapperUiTooltip>);

    const trigger: HTMLElement = screen.getByText(triggerText);
    expect(trigger).toBeInTheDocument();

    // First click -> toggleTooltip with open === false -> opens.
    fireEvent.click(trigger);
    expect(screen.getByRole(tooltipRole)).toBeInTheDocument();

    // Second click -> toggleTooltip with open === true -> closes.
    fireEvent.click(trigger);
    return waitFor(() => {
      expect(screen.queryByRole(tooltipRole)).not.toBeInTheDocument();
    });
  });

  it('closes the tooltip on click away', async () => {
    const user: UserEvent = userEvent.setup();
    render(
      <WrapperUiTooltip title={tooltipContent} placement="top" arrow sx={{ color: 'red' }}>
        {triggerText}
      </WrapperUiTooltip>
    );

    await user.click(screen.getByText(triggerText));
    expect(screen.getByRole(tooltipRole)).toBeInTheDocument();

    await user.click(document.body);
    await waitFor(() => {
      expect(screen.queryByRole(tooltipRole)).not.toBeInTheDocument();
    });
  });

  it('resets the open state when the viewport crosses a breakpoint', () => {
    const { rerender } = render(
      <WrapperUiTooltip title={tooltipContent}>{triggerText}</WrapperUiTooltip>
    );

    fireEvent.click(screen.getByText(triggerText));
    expect(screen.getByRole(tooltipRole)).toBeInTheDocument();

    // Flip the media query results so the derived breakpoint check fires.
    useMediaQueryMock.mockImplementation((query: string) => query.includes('min-width'));

    rerender(<WrapperUiTooltip title={tooltipContent}>{triggerText}</WrapperUiTooltip>);

    return waitFor(() => {
      expect(screen.queryByRole(tooltipRole)).not.toBeInTheDocument();
    });
  });

  it('re-exports a usable ClickAwayListener from the mocked module', () => {
    expect(ClickAwayListener).toBeDefined();
  });
});
