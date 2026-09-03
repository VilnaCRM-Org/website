import type { UiTooltip } from '@vilnacrm/ui-toolkit';
import type { ComponentProps } from 'react';

/**
 * The toolkit declares its prop interfaces but does not export them, so the
 * public prop type is derived from the component itself rather than imported.
 */
export type UiTooltipProps = ComponentProps<typeof UiTooltip>;
