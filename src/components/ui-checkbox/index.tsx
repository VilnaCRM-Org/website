import { UiCheckbox } from '@vilnacrm/ui-toolkit';

/**
 * `UiCheckbox` now ships from `@vilnacrm/ui-toolkit`. This module stays as the
 * import seam so existing `@/components/ui-checkbox` call sites and the
 * `@/components` barrel are untouched by the swap.
 */
export default UiCheckbox;
