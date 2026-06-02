import { Button, ThemeProvider } from '@mui/material';

import { theme } from './theme';
import { UiButtonProps } from './types';

function UiButton({
  variant,
  size,
  disabled,
  fullWidth,
  component,
  onClick,
  type,
  href,
  children,
  sx,
  name,
}: UiButtonProps): React.ReactElement {
  const componentProps = component ? { component } : {};
  const hrefProps = href ? { href } : {};

  return (
    <ThemeProvider theme={theme}>
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        fullWidth={fullWidth}
        type={type}
        onClick={onClick}
        sx={sx}
        name={name}
        {...componentProps}
        {...hrefProps}
      >
        {children}
      </Button>
    </ThemeProvider>
  );
}

export default UiButton;
