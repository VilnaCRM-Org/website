import { TextFieldProps } from '@mui/material';

export interface UiInputProps {
  sx?: React.CSSProperties;
  placeholder?: string;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: boolean;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  type?: string | undefined;
  fullWidth?: boolean | undefined;
  disabled?: boolean;
  onInput?: TextFieldProps['onInput'];
  id?: string;
}
