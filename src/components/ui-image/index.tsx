import { UiImage } from '@vilnacrm/ui-toolkit';

/**
 * `UiImage` now ships from `@vilnacrm/ui-toolkit`. This module stays as the
 * import seam so existing `@/components/ui-image` call sites and the
 * `@/components` barrel are untouched by the swap.
 */
export default UiImage;
