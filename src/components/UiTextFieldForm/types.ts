import { TextFieldProps } from '@mui/material';
import { Control, FieldValues, Path } from 'react-hook-form';

export interface CustomTextField<T extends FieldValues>
  extends TextFieldProps<'standard'> {
  control: Control<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rules: any;
  name: Path<T>;
  placeholder: string;
  type?: string;
  fullWidth?: boolean;
  errors?: boolean;
}
