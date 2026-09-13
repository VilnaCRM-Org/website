import { TextField, TextFieldProps, ThemeProvider } from '@mui/material';
import React from 'react';

import { theme } from './theme';
import { UiInputProps } from './types';

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
