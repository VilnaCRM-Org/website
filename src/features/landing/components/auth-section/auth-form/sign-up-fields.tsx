import { Stack } from '@mui/material';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiTextFieldForm, UiTooltip, UiTypography } from '@/components';

import QuestionMark from '../../../assets/svg/auth-section/questionMark.svg';
import { RegisterItem } from '../../../types/authentication/form';
import { PasswordTip } from '../password-tip';
import {
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validatePassword,
} from '../validations';

import styles from './styles';
import { AuthFormProps } from './types';

type FieldValidator = (value: string, formValues: RegisterItem) => string | boolean | null;

type SignupFieldName = 'FullName' | 'Email' | 'Password' | 'ConfirmPassword';

type SignupFieldSpec = {
  name: SignupFieldName;
  labelKey: string;
  requiredKey: string;
  placeholderKey: string;
  validate: FieldValidator;
  type: string;
  /**
   * Autofill token. Without it (and the `name` the field now also emits) a
   * password manager cannot recognise the credential fields, so it never offers
   * to generate a strong password (#382 F3). Both password fields use
   * `new-password`: this is account creation, never a sign-in.
   */
  autoComplete: string;
  /** Extra element describing the field, beyond its validation message. */
  describedBy?: string;
};

// The hidden, always-present statement of the password policy. The tooltip is a
// pointer-only affordance, so the rules also need a form the keyboard and
// screen-reader path can reach before the first rejection (#382 F4).
const PASSWORD_REQUIREMENTS_ID: string = 'password-requirements';

const SIGNUP_FIELDS: readonly SignupFieldSpec[] = [
  {
    name: 'FullName',
    labelKey: 'sign_up.form.name_input.label',
    requiredKey: 'sign_up.form.name_input.required',
    placeholderKey: 'sign_up.form.name_input.placeholder',
    validate: validateFullName,
    type: 'text',
    autoComplete: 'name',
  },
  {
    name: 'Email',
    labelKey: 'sign_up.form.email_input.label',
    requiredKey: 'sign_up.form.email_input.required',
    placeholderKey: 'sign_up.form.email_input.placeholder',
    validate: validateEmail,
    type: 'email',
    autoComplete: 'email',
  },
  {
    name: 'Password',
    labelKey: 'sign_up.form.password_input.label',
    requiredKey: 'sign_up.form.password_input.required',
    placeholderKey: 'sign_up.form.password_input.placeholder',
    validate: validatePassword,
    type: 'password',
    autoComplete: 'new-password',
    describedBy: PASSWORD_REQUIREMENTS_ID,
  },
  {
    name: 'ConfirmPassword',
    labelKey: 'sign_up.form.confirm_password_input.label',
    requiredKey: 'sign_up.form.confirm_password_input.required',
    placeholderKey: 'sign_up.form.confirm_password_input.placeholder',
    validate: validateConfirmPassword,
    type: 'password',
    autoComplete: 'new-password',
  },
];

function FieldLabel({
  htmlFor,
  labelKey,
}: {
  htmlFor: string;
  labelKey: string;
}): React.ReactElement {
  const { t } = useTranslation();

  return (
    <UiTypography variant="medium14" sx={styles.inputTitle} component="label" htmlFor={htmlFor}>
      {t(labelKey)}
    </UiTypography>
  );
}

function FormField({
  control,
  field,
  adornment,
}: {
  control: AuthFormProps['control'];
  field: SignupFieldSpec;
  adornment: React.ReactNode;
}): React.ReactElement {
  const { t } = useTranslation();
  const { name, labelKey, requiredKey, placeholderKey, validate, type, autoComplete } = field;

  return (
    <Stack sx={styles.inputWrapper}>
      {adornment ? (
        <Stack direction="row" sx={{ alignItems: 'center', gap: '0.25rem' }}>
          <FieldLabel htmlFor={name} labelKey={labelKey} />
          {adornment}
        </Stack>
      ) : (
        <FieldLabel htmlFor={name} labelKey={labelKey} />
      )}
      <UiTextFieldForm
        id={name}
        control={control}
        name={name}
        // No react-hook-form `deps` between Password and ConfirmPassword: it
        // would `trigger()` the confirmation field the moment the password is
        // touched, showing a "required" error on a field the user has not
        // reached yet, which contradicts the form's `onTouched` mode. A
        // mismatch can still never be submitted — `handleSubmit` re-validates
        // every field before calling `onSubmit`.
        rules={{ required: t(requiredKey), validate }}
        placeholder={t(placeholderKey)}
        type={type}
        autoComplete={autoComplete}
        describedBy={field.describedBy}
      />
    </Stack>
  );
}

function PasswordAdornment(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <UiTooltip placement="right" sx={styles.tip} arrow title={<PasswordTip />}>
      <Image src={QuestionMark} alt={t('sign_up.form.password_tip.alt')} width={16} height={16} />
    </UiTooltip>
  );
}

function PasswordRequirements(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <UiTypography
      id={PASSWORD_REQUIREMENTS_ID}
      component="span"
      variant="medium14"
      sx={styles.visuallyHidden}
    >
      {t('sign_up.form.password_input.requirements')}
    </UiTypography>
  );
}

function SignUpFields({ control }: { control: AuthFormProps['control'] }): React.ReactElement {
  return (
    <Stack sx={styles.inputsWrapper}>
      {SIGNUP_FIELDS.map(field => (
        <FormField
          key={field.name}
          control={control}
          field={field}
          adornment={field.name === 'Password' ? <PasswordAdornment /> : null}
        />
      ))}
      <PasswordRequirements />
    </Stack>
  );
}

export default SignUpFields;
