import { ButtonProps } from '@mui/material';

export interface UiButtonProps {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  disabled?: ButtonProps['disabled'];
  fullWidth?: ButtonProps['fullWidth'];
  component?: ButtonProps['component'];
  onClick?: ButtonProps['onClick'];
  type?: ButtonProps['type'];
  href?: ButtonProps['href'];
  children?: ButtonProps['children'];
  sx?: ButtonProps['sx'];
  name?: string;
}
