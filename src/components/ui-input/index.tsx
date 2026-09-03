import { UiInput as ToolkitUiInput } from '@vilnacrm/ui-toolkit';
import React from 'react';

import { UiInputProps } from './types';

/**
 * `UiInput` renders the `@vilnacrm/ui-toolkit` input. The adapter survives the
 * swap because the toolkit does not model this repo's two ARIA props: it has no
 * `describedBy`, and its `required` would reach the DOM as the native attribute.
 *
 * ARIA attributes have to land on the rendered `<input>`; passed as top-level
 * TextField props they would decorate the wrapping FormControl instead, where
 * assistive tech never reads them. Each is emitted only when it carries meaning
 * — `aria-required="false"` and an empty `aria-describedby` are noise. The
 * toolkit forwards caller `slotProps` to its TextField unmodified, so this is
 * the supported seam rather than a workaround.
 */
function buildInputSlotProps(
  describedBy: string | undefined,
  required: boolean | undefined
): React.ComponentProps<typeof ToolkitUiInput>['slotProps'] {
  return {
    htmlInput: {
      ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      ...(required ? { 'aria-required': true } : {}),
    },
  };
}

const UiInput: React.ForwardRefExoticComponent<
  UiInputProps & React.RefAttributes<HTMLInputElement>
> = React.forwardRef<HTMLInputElement, UiInputProps>(
  ({ describedBy, required, ...inputProps }, ref) => (
    <ToolkitUiInput
      {...inputProps}
      ref={ref}
      slotProps={buildInputSlotProps(describedBy, required)}
    />
  )
);

UiInput.displayName = 'UiInput';

export default UiInput;
