import { Box, Stack } from '@mui/material';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { RegisterItem } from '../../../types/authentication/form';
import { PasswordTip } from '../PasswordTip';
import { validateFullName, validatePassword, validateEmail } from '../Validations';

import styles from './styles';
import { AuthFormProps } from './types';

const PRIVACY_POLICY_URL: string =
  process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL || 'https://github.com/VilnaCRM-Org';

function AuthForm({ setIsAuthenticated, signupMutation }: AuthFormProps): React.ReactElement {
  const [serverError, setServerError] = React.useState('');
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterItem>({
    mode: 'onTouched',
  });
  const { t } = useTranslation();

  const onSubmit: (data: RegisterItem) => Promise<void> = async (data: RegisterItem) => {
    try {
      setServerError('');
      await signupMutation({
        variables: {
          input: {
            email: data.Email,
            initials: data.FullName,
            password: data.Password,
            clientMutationId: '132',
          },
        },
      });
      setIsAuthenticated(true);
    } catch (error) {
      if (error instanceof Error) {
        setServerError(error.message);
      } else {
        setServerError('An unexpected error occurred');
      }
    }
  };

  return (
    <Box component="form" data-testid="auth-form" onSubmit={handleSubmit(onSubmit)}>
      <UiTypography variant="h4" component="h4" sx={styles.formTitle}>
        {t('sign_up.form.heading_main')}
      </UiTypography>
      <Stack sx={styles.inputsWrapper}>
        <Stack sx={styles.inputWrapper}>
          <UiTypography variant="medium14" sx={styles.inputTitle}>
            {t('sign_up.form.name_input.label')}
          </UiTypography>
          <UiTextFieldForm
            control={control}
            name="FullName"
            rules={{
              required: t('sign_up.form.name_input.required'),
              validate: validateFullName,
            }}
            placeholder={t('sign_up.form.name_input.placeholder')}
            type="text"
          />
        </Stack>
        <Stack sx={styles.inputWrapper}>
          <UiTypography variant="medium14" sx={styles.inputTitle}>
            {t('sign_up.form.email_input.label')}
          </UiTypography>
          <UiTextFieldForm
            control={control}
            name="Email"
            rules={{
              required: t('sign_up.form.email_input.required'),
              validate: validateEmail,
            }}
            placeholder={t('sign_up.form.email_input.placeholder')}
            type="text"
          />
          {serverError && (
            <UiTypography variant="medium14" sx={styles.errorText} role="alert">
              {serverError}
            </UiTypography>
          )}
        </Stack>
        <Stack sx={styles.inputWrapper}>
          <Stack direction="row" alignItems="center" gap="0.25rem">
            <UiTypography variant="medium14" sx={styles.inputTitle}>
              {t('sign_up.form.password_input.label')}
            </UiTypography>
            <UiTooltip placement="right" sx={styles.tip} arrow title={<PasswordTip />}>
              <Image
                src={QuestionMark}
                alt={t('sign_up.form.password_tip.alt')}
                width={16}
                height={16}
              />
            </UiTooltip>
          </Stack>
          <UiTextFieldForm
            control={control}
            name="Password"
            rules={{
              required: t('sign_up.form.password_input.required'),
              validate: validatePassword,
            }}
            placeholder={t('sign_up.form.password_input.placeholder')}
            type="password"
          />
        </Stack>
      </Stack>
      <Controller
        control={control}
        name="Privacy"
        rules={{ required: true }}
        render={({ field }) => (
          <UiCheckbox
            onChange={e => field.onChange(e)}
            error={!!errors.Privacy}
            sx={styles.labelText as React.CSSProperties}
            label={
              <UiTypography variant="medium14" sx={styles.privacyText}>
                <Trans i18nKey="sign_up.form.confidential_text.fullText">
                  I have read and accept the
                  <UiLink href={PRIVACY_POLICY_URL} target="_blank">
                    Privacy Policy
                  </UiLink>
                  and the
                  <UiLink href={PRIVACY_POLICY_URL} target="_blank">
                    Use Policy
                  </UiLink>
                  VilnaCRM Service
                </Trans>
              </UiTypography>
            }
          />
        )}
      />
      <Box sx={styles.buttonWrapper}>
        <UiButton sx={styles.button} variant="contained" size="medium" type="submit" fullWidth>
          {t('sign_up.form.button_text')}
        </UiButton>
      </Box>
    </Box>
  );
}

export default AuthForm;
