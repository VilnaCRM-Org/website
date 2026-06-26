import { Box, Stack } from '@mui/material';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { Controller } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';

import {
  UiButton,
  UiCheckbox,
  UiLink,
  UiTextFieldForm,
  UiTooltip,
  UiTypography,
} from '@/components';

import QuestionMark from '../../../assets/svg/auth-section/questionMark.svg';
import { PasswordTip } from '../password-tip';
import { validateFullName, validatePassword, validateEmail } from '../validations';

import styles from './styles';
import { AuthFormProps } from './types';

type FieldValidator = (value: string) => string | boolean | null;

type FormFieldProps = {
  control: AuthFormProps['control'];
  name: 'FullName' | 'Email' | 'Password';
  labelKey: string;
  requiredKey: string;
  placeholderKey: string;
  validate: FieldValidator;
  type: string;
  adornment: React.ReactNode;
};

const SIGNUP_FIELDS: ReadonlyArray<Omit<FormFieldProps, 'control' | 'adornment'>> = [
  {
    name: 'FullName',
    labelKey: 'sign_up.form.name_input.label',
    requiredKey: 'sign_up.form.name_input.required',
    placeholderKey: 'sign_up.form.name_input.placeholder',
    validate: validateFullName,
    type: 'text',
  },
  {
    name: 'Email',
    labelKey: 'sign_up.form.email_input.label',
    requiredKey: 'sign_up.form.email_input.required',
    placeholderKey: 'sign_up.form.email_input.placeholder',
    validate: validateEmail,
    type: 'email',
  },
  {
    name: 'Password',
    labelKey: 'sign_up.form.password_input.label',
    requiredKey: 'sign_up.form.password_input.required',
    placeholderKey: 'sign_up.form.password_input.placeholder',
    validate: validatePassword,
    type: 'password',
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
  name,
  labelKey,
  requiredKey,
  placeholderKey,
  validate,
  type,
  adornment,
}: FormFieldProps): React.ReactElement {
  const { t } = useTranslation();

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
        rules={{ required: t(requiredKey), validate }}
        placeholder={t(placeholderKey)}
        type={type}
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

function SignUpFields({ control }: { control: AuthFormProps['control'] }): React.ReactElement {
  return (
    <Stack sx={styles.inputsWrapper}>
      {SIGNUP_FIELDS.map(field => (
        <FormField
          key={field.name}
          control={control}
          name={field.name}
          labelKey={field.labelKey}
          requiredKey={field.requiredKey}
          placeholderKey={field.placeholderKey}
          validate={field.validate}
          type={field.type}
          adornment={field.name === 'Password' ? <PasswordAdornment /> : null}
        />
      ))}
    </Stack>
  );
}

function PrivacyField({
  control,
  formValidationErrors,
}: Pick<AuthFormProps, 'control' | 'formValidationErrors'>): React.ReactElement {
  return (
    <Controller
      control={control}
      name="Privacy"
      rules={{ required: true }}
      render={({ field: { value, onChange } }) => (
        <UiCheckbox
          onChange={onChange}
          checked={value}
          error={!!formValidationErrors.Privacy}
          sx={styles.labelText as React.CSSProperties}
          label={
            <UiTypography variant="medium14" sx={styles.privacyText}>
              <Trans i18nKey="sign_up.form.confidential_text.fullText">
                I have read and accept the
                <UiLink
                  href="https://github.com/VilnaCRM-Org"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </UiLink>
                and the
                <UiLink href="https://github.com/VilnaCRM-Org" target="_blank">
                  Use Policy
                </UiLink>
                VilnaCRM Service
              </Trans>
            </UiTypography>
          }
        />
      )}
    />
  );
}

function AuthForm({
  onSubmit,
  handleSubmit,
  control,
  formValidationErrors,
  loading,
}: AuthFormProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} aria-label="SignUpForm">
      <UiTypography variant="h4" component="h4" sx={styles.formTitle}>
        {t('sign_up.form.heading_main')}
      </UiTypography>
      <SignUpFields control={control} />
      <PrivacyField control={control} formValidationErrors={formValidationErrors} />

      <Box sx={styles.buttonWrapper}>
        <UiButton
          sx={styles.button}
          variant="contained"
          size="medium"
          type="submit"
          fullWidth
          disabled={loading}
        >
          {t('sign_up.form.button_text')}
        </UiButton>
      </Box>
    </Box>
  );
}

export default AuthForm;
