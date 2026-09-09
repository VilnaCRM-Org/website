import type { UiButtonProps as ToolkitUiButtonProps } from '@vilnacrm/ui-toolkit/ui-button';
import type { HTMLAttributeAnchorTarget } from 'react';

/**
 * `rel` and `target` are anchor attributes, so MUI's `ButtonProps` — which the
 * toolkit's prop type extends unchanged — does not declare them, even though the
 * toolkit forwards every unknown prop to the underlying MUI `Button` and MUI
 * renders an anchor whenever `href` is set. They are declared here so the
 * anchor-flavoured call sites this repo tests stay type-safe.
 *
 * v0.4.0 exports `UiButtonProps`, so this extends the real type rather than a
 * reconstruction — but the type still does not declare `rel`/`target`. Fold this
 * back into the toolkit's own `UiButtonProps` when it grows them.
 */
export type UiButtonProps = ToolkitUiButtonProps & {
  rel?: string;
  target?: HTMLAttributeAnchorTarget;
};
