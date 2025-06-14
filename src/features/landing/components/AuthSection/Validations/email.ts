import { t } from 'i18next';

export const isValidEmailFormat: (email: string) => boolean = (email: string): boolean =>
  /^.+@.+\..+$/.test(email);

const validateEmail: (email: string) => string | boolean = (email: string): string | boolean => {
  if (!isValidEmailFormat(email)) {
    if (!email.includes('@') || !email.includes('.')) {
      return t('sign_up.form.email_input.email_format_error');
    }
    return t('sign_up.form.email_input.invalid_message');
  }
  return true;
};

export default validateEmail;
