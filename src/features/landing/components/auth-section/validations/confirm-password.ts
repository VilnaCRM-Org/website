import { t } from 'i18next';

/**
 * Confirm-password check (#382 F4).
 *
 * Registration is the one place a typo is unrecoverable — the account is created
 * with a password the user never intended and cannot guess afterwards. The rule
 * reads the sibling `Password` value that react-hook-form passes as the second
 * `validate` argument, so it stays a pure function of the form values.
 */
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
