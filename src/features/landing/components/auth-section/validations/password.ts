import { t } from 'i18next';

const isLengthValid: (value: string) => boolean = (value: string): boolean =>
  value.length >= 8 && value.length <= 64;

const hasNumber: (value: string) => boolean = (value: string): boolean => /[0-9]/.test(value);

const hasUppercase: (value: string) => boolean = (value: string): boolean => /\p{Lu}/u.test(value);

// Unicode-aware, matching `hasUppercase`: a Cyrillic password such as
// `Пароль123` has to satisfy the case rules the same way a Latin one does.
const hasLowercase: (value: string) => boolean = (value: string): boolean => /\p{Ll}/u.test(value);

type PasswordRule = { isValid: (value: string) => boolean; messageKey: string };

// Length + digit + uppercase alone accepted `PASSWORD1`; requiring a lowercase
// letter as well brings the enforced policy in line with the character classes
// the password tip already advertises (#382 F4).
const PASSWORD_RULES: readonly PasswordRule[] = [
  { isValid: isLengthValid, messageKey: 'sign_up.form.password_input.error_length' },
  { isValid: hasNumber, messageKey: 'sign_up.form.password_input.error_numbers' },
  { isValid: hasUppercase, messageKey: 'sign_up.form.password_input.error_uppercase' },
  { isValid: hasLowercase, messageKey: 'sign_up.form.password_input.error_lowercase' },
];

const validatePassword: (value: string) => string | boolean = (value: string): string | boolean => {
  const failedRule: PasswordRule | undefined = PASSWORD_RULES.find(rule => !rule.isValid(value));
  return failedRule ? t(failedRule.messageKey) : true;
};

export default validatePassword;
