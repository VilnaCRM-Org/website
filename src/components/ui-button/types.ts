import type { UiButton } from '@vilnacrm/ui-toolkit';
import type { ComponentProps, HTMLAttributeAnchorTarget } from 'react';

type ToolkitUiButtonProps = ComponentProps<typeof UiButton>;

/**
 * `rel` and `target` are anchor attributes, so MUI's `ButtonProps` — which the
 * toolkit's prop type extends unchanged — does not declare them, even though the
 * toolkit forwards every unknown prop to the underlying MUI `Button` and MUI
 * renders an anchor whenever `href` is set. They are declared here so the
 * anchor-flavoured call sites this repo tests stay type-safe.
 *
 * Fold this back into the toolkit's own `UiButtonProps` when it grows them.
 */
export type UiButtonProps = ToolkitUiButtonProps & {
  rel?: string;
  target?: HTMLAttributeAnchorTarget;
};
