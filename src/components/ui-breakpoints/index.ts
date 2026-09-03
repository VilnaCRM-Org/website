import { UiBreakpoints } from '@vilnacrm/ui-toolkit';

/**
 * The website breakpoint scale now ships from `@vilnacrm/ui-toolkit`. This module
 * stays as the import seam so the 28 existing `@/components/ui-breakpoints`
 * call sites are untouched by the swap.
 *
 * The toolkit values are identical to the ones they replace:
 * xs 375, sm 640, md 768, lg 1024, xl 1440.
 */
export default UiBreakpoints;
