import ToolkitUiInput from '@vilnacrm/ui-toolkit/ui-input';
import React from 'react';

import styles from './styles';
import { UiInputProps } from './types';

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
  ({ describedBy, required, sx, ...inputProps }, ref) => (
    <ToolkitUiInput
      {...inputProps}
      ref={ref}
      sx={styles.withRootTracking(sx)}
      slotProps={buildInputSlotProps(describedBy, required)}
    />
  )
);

UiInput.displayName = 'UiInput';

export default UiInput;
