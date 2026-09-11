import { Controller, ControllerRenderProps, FieldError, FieldValues } from 'react-hook-form';

import UiInput from '../ui-input';
import UiTypography from '../ui-typography';

import styles from './styles';
import { CustomTextField } from './types';

function composeDescribedBy(...ids: (string | undefined)[]): string | undefined {
  const present: string[] = ids.filter((id): id is string => Boolean(id));
  return present.length > 0 ? present.join(' ') : undefined;
}

function isRequiredRule(required: unknown): boolean {
  if (typeof required === 'object' && required !== null) {
    return Boolean((required as { value?: unknown }).value);
  }
  return Boolean(required);
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

function FieldView<T extends FieldValues>({
  field,
  error,
  config,
  inputId,
  errorId,
}: FieldViewProps<T>): React.ReactElement {
  const { placeholder, type, fullWidth, autoComplete, describedBy, rules } = config;
  const { name, value, onChange, onBlur, ref: registerInput } = field;

  return (
    <>
      <UiInput
        id={inputId}
        name={name}
        ref={registerInput}
        autoComplete={autoComplete}
        describedBy={composeDescribedBy(describedBy, error ? errorId : undefined)}
        required={isRequiredRule(rules.required)}
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
