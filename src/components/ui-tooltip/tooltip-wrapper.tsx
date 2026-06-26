import { ClickAwayListener, Tooltip, Typography, useMediaQuery } from '@mui/material';
import React from 'react';

import { UiTooltipProps } from './types';

// Close the tooltip when the viewport crosses a breakpoint. Derived during
// render (React's "adjusting state on prop change" pattern) instead of an
// effect, which avoids the extra render that set-state-in-effect flags. This is
// a render-phase hook, NOT an effect — the set-state runs during render by design.
function useCloseOnBreakpointChange(setOpen: (open: boolean) => void): void {
  const isWideScreenMaxWidth: boolean = useMediaQuery('(max-width: 640px)');
  const isWideScreenMinWidth: boolean = useMediaQuery('(min-width: 640px)');
  const [prevBreakpoints, setPrevBreakpoints] = React.useState<{
    max: boolean;
    min: boolean;
  }>({ max: isWideScreenMaxWidth, min: isWideScreenMinWidth });

  if (
    prevBreakpoints.max !== isWideScreenMaxWidth ||
    prevBreakpoints.min !== isWideScreenMinWidth
  ) {
    setPrevBreakpoints({ max: isWideScreenMaxWidth, min: isWideScreenMinWidth });
    setOpen(false);
  }
}

export default function WrapperUiTooltip({
  title,
  placement,
  arrow,
  sx,
  children,
}: UiTooltipProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  useCloseOnBreakpointChange(setOpen);

  const closeTooltip: () => void = () => setOpen(false);
  const toggleTooltip: () => void = () => setOpen(!open);

  return (
    <ClickAwayListener onClickAway={closeTooltip}>
      <Tooltip open={open} title={title} placement={placement} arrow={arrow} sx={sx}>
        <Typography component="span" onClick={toggleTooltip}>
          {children}
        </Typography>
      </Tooltip>
    </ClickAwayListener>
  );
}
