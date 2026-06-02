import { Button, ThemeProvider } from '@mui/material';

import { theme } from './theme';
import { UiButtonProps } from './types';

function UiButton({
  variant,
  size,
  disabled,
  fullWidth,
  onClick,
  type,
  href,
  children,
  sx,
  name,
}: UiButtonProps): React.ReactElement {
  return (
    <ThemeProvider theme={theme}>
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        fullWidth={fullWidth}
        type={type}
        href={href}
        onClick={onClick}
        sx={sx}
        name={name}
      >
        {children}
      </Button>
    </ThemeProvider>
  );
}

export default UiButton;
