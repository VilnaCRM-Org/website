import type { UiInputProps as ToolkitOwnProps } from '@vilnacrm/ui-toolkit/ui-input';

/**
 * The toolkit publishes its prop type on the subpath since v0.4.0, so this is
 * imported rather than reconstructed from the component's signature.
 *
 * `slotProps` is withheld because this adapter owns it — it is how the ARIA
 * attributes below reach the rendered `<input>`. `required` is withheld because
 * the toolkit would forward it as the native attribute; see below.
 *
 * `describedBy` is withheld for a narrower reason. v0.4.0 models it natively,
 * but it declares the prop as `describedBy?: string` with no `| undefined`, and
 * this repository compiles under `exactOptionalPropertyTypes`, where those are
 * different types: a caller that passes an optional value through cannot satisfy
 * the toolkit's declaration. Re-declaring it below restores the `| undefined`
 * the upstream type omits. Drop the omission once the toolkit widens it.
 */
type ToolkitUiInputProps = Omit<ToolkitOwnProps, 'ref' | 'slotProps' | 'required' | 'describedBy'>;

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
