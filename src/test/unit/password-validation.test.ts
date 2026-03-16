import { t } from 'i18next';

import { validatePassword } from '../../features/landing/components/AuthSection/Validations';

const tooShortPassword: string = 'Abc1234';

const tooLongPassword: string = `A1${'b'.repeat(63)}`;

const noNumbersPassword: string = 'PasswordOnly';

const noUppercasePassword: string = 'password1';

const onlyNumbers: string = '1234567890';

const onlyUppercase: string = 'ABCDEFGHIJ';

const correctPassword: string = 'ValidPassword123';
const shortestValidPassword: string = 'Abcdefg1';
const longestValidPassword: string = `A1${'b'.repeat(62)}`;

const passwordLengthError: string = t('sign_up.form.password_input.error_length');
const passwordNumbersError: string = t('sign_up.form.password_input.error_numbers');
const passwordUppercaseError: string = t('sign_up.form.password_input.error_uppercase');

describe('validatePassword', () => {
  it('should return true when password is valid', () => {
    expect(validatePassword(correctPassword)).toBe(true);
  });

  it('should return true for boundary valid lengths', () => {
    expect(validatePassword(shortestValidPassword)).toBe(true);
    expect(validatePassword(longestValidPassword)).toBe(true);
  });

  it('should return localized error message when password is empty', () => {
    expect(validatePassword('')).toBe(passwordLengthError);
  });

  it('should return localized error message when password is too short', () => {
    expect(validatePassword(tooShortPassword)).toBe(passwordLengthError);
  });

  it('should return localized error message when password is too long', () => {
    expect(validatePassword(tooLongPassword)).toBe(passwordLengthError);
  });

  it("should return localized error message when password doesn't contain numbers", () => {
    expect(validatePassword(noNumbersPassword)).toBe(passwordNumbersError);
  });

  it("should return localized error message when password doesn't contain uppercase letters", () => {
    expect(validatePassword(noUppercasePassword)).toBe(passwordUppercaseError);
  });

  it('should return localized error message when password contains only numbers', () => {
    expect(validatePassword(onlyNumbers)).toBe(passwordUppercaseError);
  });

  it('should return localized error message when password contains only uppercase letters', () => {
    expect(validatePassword(onlyUppercase)).toBe(passwordNumbersError);
  });
});
