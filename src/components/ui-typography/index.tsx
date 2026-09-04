import { UiTypography } from '@vilnacrm/ui-toolkit';

/**
 * `UiTypography` now ships from `@vilnacrm/ui-toolkit`. This module stays as the
 * import seam so existing `@/components/ui-typography` call sites and the
 * `@/components` barrel are untouched by the swap.
 */
export default UiTypography;
