import { t } from 'i18next';

import { validateConfirmPassword } from '../../features/landing/components/auth-section/validations';

const mismatchError: string = t('sign_up.form.confirm_password_input.error_mismatch');

const password: string = 'ValidPassword123';

describe('validateConfirmPassword', () => {
  it('accepts a confirmation identical to the password', () => {
    expect(validateConfirmPassword(password, { Password: password })).toBe(true);
  });

  it('returns the localized mismatch error when the values differ', () => {
    expect(validateConfirmPassword('ValidPassword124', { Password: password })).toBe(mismatchError);
  });

  it('rejects a confirmation that differs only by case or trailing space', () => {
    expect(validateConfirmPassword('validpassword123', { Password: password })).toBe(mismatchError);
    expect(validateConfirmPassword(`${password} `, { Password: password })).toBe(mismatchError);
  });

  it('treats two empty values as matching and leaves emptiness to the required rule', () => {
    expect(validateConfirmPassword('', { Password: '' })).toBe(true);
  });

  it('rejects an empty confirmation when a password was entered', () => {
    expect(validateConfirmPassword('', { Password: password })).toBe(mismatchError);
  });
});
