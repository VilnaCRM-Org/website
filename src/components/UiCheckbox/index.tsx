/* eslint-disable react/jsx-props-no-spreading */
import { Box, FormControlLabel } from '@mui/material';
import React from 'react';

import styles from './styles';
import { UiCheckboxProps } from './types';

function UiCheckbox({ label, sx, onChange }: UiCheckboxProps) {
  return (
    <FormControlLabel
      sx={sx}
      control={
        <Box
          className="MuiButtonBase-root MuiCheckbox-root MuiCheckbox-colorPrimary MuiCheckbox-sizeMedium PrivateSwitchBase-root MuiCheckbox-root MuiCheckbox-colorPrimary MuiCheckbox-sizeMedium MuiCheckbox-root MuiCheckbox-colorPrimary MuiCheckbox-sizeMedium css-12wnr2w-MuiButtonBase-root-MuiCheckbox-root"
          component="span"
          onChange={onChange}
          sx={styles.checkboxWrapper}
        >
          <input type="checkbox" className="PrivateSwitchBase-input" />
        </Box>
      }
      label={label}
    />
  );
}

export default UiCheckbox;
