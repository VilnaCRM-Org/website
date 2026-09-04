import { UiTooltip } from '@vilnacrm/ui-toolkit';

/**
 * `UiTooltip` now ships from `@vilnacrm/ui-toolkit`. This module stays as the
 * import seam so existing `@/components/ui-tooltip` call sites and the
 * `@/components` barrel are untouched by the swap.
 *
 * The toolkit component is a superset of the local one it replaces: it keeps the
 * same click-to-toggle trigger, `ClickAwayListener` dismissal and
 * close-on-breakpoint-change behaviour, and adds keyboard operation
 * (Enter/Space toggle, Escape close) plus `role="button"`, `aria-expanded`,
 * `aria-controls` and an optional `triggerLabel` accessible name. The local
 * `tooltip-wrapper` is therefore gone — the toolkit implements it inline.
 */
export default UiTooltip;
