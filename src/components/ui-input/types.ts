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
  /**
   * Submitted field name. Password managers and browser autofill key off `name`
   * and `autocomplete` together; without both, a credential field is
   * effectively invisible to them and no strong password is ever offered
   * (#382 F3).
   */
  name?: string | undefined;
  autoComplete?: string | undefined;
  /**
   * `aria-describedby` for the rendered input. MUI wires this itself only when
   * `helperText` is used, and it has to land on the `<input>` rather than the
   * wrapping FormControl to be honoured by assistive tech.
   */
  describedBy?: string | undefined;
  /**
   * Emits `aria-required` only — deliberately not the native `required`
   * attribute, which would hand validation to the browser and pre-empt the
   * react-hook-form messages the suites assert.
   */
  required?: boolean;
}
