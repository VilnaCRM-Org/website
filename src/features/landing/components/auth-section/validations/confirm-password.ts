import { t } from 'i18next';

export interface PasswordConfirmationValues {
  Password: string;
}

const validateConfirmPassword: (
  value: string,
  formValues: PasswordConfirmationValues
) => string | boolean = (
  value: string,
  formValues: PasswordConfirmationValues
): string | boolean =>
  value === formValues.Password ? true : t('sign_up.form.confirm_password_input.error_mismatch');

export default validateConfirmPassword;
