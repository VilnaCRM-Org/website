import { UiToolbar } from '@vilnacrm/ui-toolkit';

/**
 * `UiToolbar` now ships from `@vilnacrm/ui-toolkit`. This module stays as the
 * import seam so existing `@/components/ui-toolbar` call sites and the
 * `@/components` barrel are untouched by the swap.
 */
export default UiToolbar;
