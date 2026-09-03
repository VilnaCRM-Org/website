import type { UiInput } from '@vilnacrm/ui-toolkit';
import type { ComponentProps } from 'react';

/**
 * The toolkit declares its prop interfaces but does not export them, so the
 * toolkit surface is derived from the component itself rather than imported.
 *
 * `slotProps` is withheld because this adapter owns it — it is how the ARIA
 * attributes below reach the rendered `<input>`. `required` is withheld because
 * the toolkit would forward it as the native attribute; see below.
 */
type ToolkitUiInputProps = Omit<ComponentProps<typeof UiInput>, 'ref' | 'slotProps' | 'required'>;

export type UiInputProps = ToolkitUiInputProps & {
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
