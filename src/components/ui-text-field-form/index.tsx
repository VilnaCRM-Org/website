import { Controller, ControllerRenderProps, FieldError, FieldValues } from 'react-hook-form';

import UiInput from '../ui-input';
import UiTypography from '../ui-typography';

import styles from './styles';
import { CustomTextField } from './types';

function composeDescribedBy(...ids: (string | undefined)[]): string | undefined {
  const present: string[] = ids.filter((id): id is string => Boolean(id));
  return present.length > 0 ? present.join(' ') : undefined;
}

function FieldMessage({
  errorId,
  message,
}: {
  errorId: string;
  message: string;
}): React.ReactElement {
  return (
    <UiTypography
      id={errorId}
      aria-live="polite"
      aria-atomic
      variant="medium14"
      sx={styles.errorText}
    >
      {message}
    </UiTypography>
  );
}

interface FieldViewProps<T extends FieldValues> {
  field: ControllerRenderProps<T>;
  error: FieldError | undefined;
  config: CustomTextField<T>;
  inputId: string;
  errorId: string;
}

/**
 * The rendered field: the input plus its validation message.
 *
 * Two details are load-bearing. The input receives `field.name` (not the prop)
 * so the submitted name always tracks the registered field, and `field.ref` so
 * react-hook-form can move focus to the first invalid input on submit.
 *
 * The message container is rendered unconditionally: a live region has to exist
 * in the accessibility tree before its content changes, otherwise mounting and
 * filling it in the same commit is announced inconsistently across screen
 * readers. `aria-live="polite"` rather than `role="alert"` keeps
 * blur-triggered validation from interrupting the label of the field the user
 * has just moved to. The node is absolutely positioned inside a fixed-height
 * row, so an empty one occupies no space.
 */
function FieldView<T extends FieldValues>({
  field,
  error,
  config,
  inputId,
  errorId,
}: FieldViewProps<T>): React.ReactElement {
  const { placeholder, type, fullWidth, autoComplete, describedBy, rules } = config;
  // `ref` here is react-hook-form's callback ref, not a ref object: it is what
  // lets the library move focus to the first invalid input on submit.
  const { name, value, onChange, onBlur, ref: registerInput } = field;

  return (
    <>
      <UiInput
        id={inputId}
        name={name}
        ref={registerInput}
        autoComplete={autoComplete}
        describedBy={composeDescribedBy(describedBy, error ? errorId : undefined)}
        required={Boolean(rules.required)}
        type={type}
        placeholder={placeholder}
        onChange={onChange}
        onBlur={onBlur}
        value={value}
        error={!!error}
        fullWidth={fullWidth}
      />
      <FieldMessage errorId={errorId} message={error?.message ?? ''} />
    </>
  );
}

function UiTextFieldForm<T extends FieldValues>(config: CustomTextField<T>): React.ReactElement {
  const { control, rules, name, id } = config;
  const inputId: string = id ?? String(name);
  const errorId: string = `${inputId}-error`;

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <FieldView
          field={field}
          error={error}
          config={config}
          inputId={inputId}
          errorId={errorId}
        />
      )}
    />
  );
}

export default UiTextFieldForm;
