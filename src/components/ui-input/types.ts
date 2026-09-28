import type { UiInputProps as ToolkitOwnProps } from '@vilnacrm/ui-toolkit/ui-input';

type AllowedToolkitProps = Pick<
  ToolkitOwnProps,
  'sx' | 'placeholder' | 'value' | 'onChange' | 'onBlur' | 'onInput' | 'error' | 'disabled' | 'id'
>;

export type UiInputProps = AllowedToolkitProps & {
  type?: string | undefined;
  fullWidth?: boolean | undefined;
  name?: string | undefined;
  autoComplete?: string | undefined;
  describedBy?: string | undefined;
  required?: boolean;
};
