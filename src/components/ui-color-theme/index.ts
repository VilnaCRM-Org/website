import { UiColorTheme } from '@vilnacrm/ui-toolkit';

/**
 * The website colour palette now ships from `@vilnacrm/ui-toolkit`. This module
 * stays as the import seam so the 21 existing `@/components/ui-color-theme`
 * call sites are untouched by the swap.
 *
 * The toolkit palette is a superset of the one it replaces: every token the
 * website referenced keeps its exact value, and the only differing token,
 * `success`, is not referenced anywhere in this repo.
 */
export default UiColorTheme;
