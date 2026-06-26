import { t } from 'i18next';

const isLengthValid: (value: string) => boolean = (value: string): boolean =>
  value.length >= 8 && value.length <= 64;

const hasNumber: (value: string) => boolean = (value: string): boolean => /[0-9]/.test(value);

const hasUppercase: (value: string) => boolean = (value: string): boolean => /\p{Lu}/u.test(value);

type PasswordRule = { isValid: (value: string) => boolean; messageKey: string };

const PASSWORD_RULES: readonly PasswordRule[] = [
  { isValid: isLengthValid, messageKey: 'sign_up.form.password_input.error_length' },
  { isValid: hasNumber, messageKey: 'sign_up.form.password_input.error_numbers' },
  { isValid: hasUppercase, messageKey: 'sign_up.form.password_input.error_uppercase' },
];

const validatePassword: (value: string) => string | boolean = (
  value: string
): string | boolean => {
  const failedRule: PasswordRule | undefined = PASSWORD_RULES.find(rule => !rule.isValid(value));
  return failedRule ? t(failedRule.messageKey) : true;
};

export default validatePassword;
