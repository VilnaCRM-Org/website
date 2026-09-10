import type { UiInputProps as ToolkitOwnProps } from '@vilnacrm/ui-toolkit/ui-input';

/**
 * An explicit ALLOW-LIST over the toolkit's prop type, not `Omit<…>` of it.
 *
 * The distinction is the point. The toolkit's `UiInputProps` extends the whole
 * of MUI's `TextFieldProps`, so subtracting a few names would hand every call
 * site several hundred more — including `slotProps` and `inputProps`, the two
 * seams this adapter owns in order to put `aria-describedby` and
 * `aria-required` on the rendered `<input>`. A caller that reached for either
 * would silently defeat #382 F3 while still type-checking.
 *
 * `Pick` keeps the listed props' types tied to the toolkit's own declarations,
 * so a widening upstream still reaches this repo; only the SET is frozen.
 */
type AllowedToolkitProps = Pick<
  ToolkitOwnProps,
  'sx' | 'placeholder' | 'value' | 'onChange' | 'onBlur' | 'onInput' | 'error' | 'disabled' | 'id'
>;

export type UiInputProps = AllowedToolkitProps & {
  /**
   * Declared here rather than picked because the toolkit writes them without
   * `| undefined`, and this repository compiles under
   * `exactOptionalPropertyTypes` — a caller passing an optional value through
   * cannot satisfy the upstream declaration. Tracked upstream as
   * VilnaCRM-Org/ui-toolkit#153.
   */
  type?: string | undefined;
  fullWidth?: boolean | undefined;
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
};
