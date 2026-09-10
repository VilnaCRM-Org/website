import type { UiTooltipProps as ToolkitUiTooltipProps } from '@vilnacrm/ui-toolkit/ui-tooltip';

/**
 * Re-exported from the toolkit rather than derived from the component's own
 * signature: since v0.4.0 each subpath publishes its prop type, so the adapter
 * no longer has to reconstruct one with `ComponentProps`.
 */
export type UiTooltipProps = ToolkitUiTooltipProps;
