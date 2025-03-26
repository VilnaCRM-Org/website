import { Box, FormControlLabel } from '@mui/material';
import React from 'react';

import styles from './styles';
import { UiCheckboxProps } from './types';

function UiCheckbox({
  label,
  sx,
  onChange,
  error,
  disabled,
  checked,
  isInvalid,
}: UiCheckboxProps): React.ReactElement {
  return (
    <FormControlLabel
      sx={sx}
      control={
        <Box component="span" sx={error ? styles.checkboxWrapperError : styles.checkboxWrapper}>
          <input
            type="checkbox"
            className="PrivateSwitchBase-input"
            disabled={disabled}
            checked={checked}
            onChange={onChange}
            aria-invalid={isInvalid ? 'true' : undefined}
          />
        </Box>
      }
      label={label}
    />
  );
}

export default UiCheckbox;
