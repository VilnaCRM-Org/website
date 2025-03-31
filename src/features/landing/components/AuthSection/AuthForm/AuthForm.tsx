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
import FormAlert from '../FormAlert';
import { PasswordTip } from '../PasswordTip';
import { validateFullName, validatePassword, validateEmail } from '../Validations';

import styles from './styles';
import { AuthFormProps } from './types';

function AuthForm({
  errorDetails,
  onSubmit,
  handleSubmit,
  control,
  errors,
}: AuthFormProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} aria-label="SignUpForm">
      <UiTypography variant="h4" component="h4" sx={styles.formTitle}>
        {t('sign_up.form.heading_main')}
      </UiTypography>
      <Stack sx={styles.inputsWrapper}>
        <Stack sx={styles.inputWrapper}>
          <UiTypography
            variant="medium14"
            sx={styles.inputTitle}
            component="label"
            htmlFor="FullName"
          >
            {t('sign_up.form.name_input.label')}
          </UiTypography>
          <UiTextFieldForm
            id="FullName"
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
          <UiTypography variant="medium14" sx={styles.inputTitle} component="label" htmlFor="Email">
            {t('sign_up.form.email_input.label')}
          </UiTypography>
          <UiTextFieldForm
            id="Email"
            control={control}
            name="Email"
            rules={{
              required: t('sign_up.form.email_input.required'),
              validate: validateEmail,
            }}
            placeholder={t('sign_up.form.email_input.placeholder')}
            type="email"
          />
          {errorDetails && <FormAlert errorDetails={errorDetails} />}
        </Stack>
        <Stack sx={styles.inputWrapper}>
          <Stack direction="row" alignItems="center" gap="0.25rem">
            <UiTypography
              variant="medium14"
              sx={styles.inputTitle}
              component="label"
              htmlFor="Password"
            >
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
            id="Password"
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
        render={({ field: { value, onChange } }) => (
          <UiCheckbox
            onChange={onChange}
            checked={value}
            error={!!errors.Privacy}
            isInvalid={errors?.Privacy?.ref?.name === 'Privacy'}
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
      <Box sx={styles.buttonWrapper}>
        <UiButton sx={styles.button} variant="contained" size="medium" type="submit" fullWidth>
          {t('sign_up.form.button_text')}
        </UiButton>
      </Box>
    </Box>
  );
}

export default AuthForm;
