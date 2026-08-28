import { TextFieldProps } from '@mui/material';
import { Control, FieldValues, Path } from 'react-hook-form';

export interface CustomTextField<T extends FieldValues> extends TextFieldProps<'standard'> {
  control: Control<T>;
  rules: FieldValues;
  name: Path<T>;
  placeholder: string;
  type?: string | undefined;
  fullWidth?: boolean | undefined;
  /**
   * Id of the rendered `<input>`. Required for a sibling `<label htmlFor>` to
   * resolve — before #382 F3 this prop was accepted by the type (inherited from
   * `TextFieldProps`) but silently dropped, so every label pointed at nothing.
   */
  id?: string | undefined;
  autoComplete?: string | undefined;
  /**
   * Id of an element describing the field (e.g. a policy hint). Composed with
   * the internally-owned validation-message id rather than replacing it.
   */
  describedBy?: string | undefined;
}
