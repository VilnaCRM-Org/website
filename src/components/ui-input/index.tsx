import { TextField, TextFieldProps, ThemeProvider } from '@mui/material';
import React from 'react';

import { theme } from './theme';
import { UiInputProps } from './types';

/**
 * ARIA attributes have to land on the rendered `<input>`; passed as top-level
 * TextField props they would decorate the wrapping FormControl instead, where
 * assistive tech never reads them. Each is emitted only when it carries meaning
 * — `aria-required="false"` and an empty `aria-describedby` are noise.
 */
function buildInputSlotProps(
  describedBy: string | undefined,
  required: boolean | undefined
): TextFieldProps['slotProps'] {
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
  ({ describedBy, required, ...textFieldProps }, ref) => (
    <ThemeProvider theme={theme}>
      <TextField
        {...textFieldProps}
        inputRef={ref}
        slotProps={buildInputSlotProps(describedBy, required)}
      />
    </ThemeProvider>
  )
);

UiInput.displayName = 'UiInput';

export default UiInput;
