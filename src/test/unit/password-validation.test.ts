import { faker } from '@faker-js/faker';
import { t } from 'i18next';

import { validatePassword } from '../../features/landing/components/AuthSection/Validations';

const textShortText: string = faker.internet.password({ length: 7 });

const textTooLong: string = faker.internet.password({ length: 65 });

const textNoNumbers: string = faker.internet.password({
  length: 10,
  pattern: /[A-Z]/,
});

const textNoUppercaseLetter: string = faker.internet.password({
  length: 10,
  pattern: /[a-z]/,
  prefix: '1',
});

const onlyNumbers: string = '1234567890';

const onlyUppercase: string = 'ABCDEFGHIJ';

const correctPassword: string = faker.internet.password({
  length: 16,
  prefix: 'Q9',
});

const passwordLengthError: string = t('sign_up.form.password_input.error_length');
const passwordNumbersError: string = t('sign_up.form.password_input.error_numbers');
const passwordUppercaseError: string = t('sign_up.form.password_input.error_uppercase');

describe('validatePassword', () => {
  it('should return true when password is valid', () => {
    expect(validatePassword(correctPassword)).toBe(true);
  });

  it('should return localized error message when password is empty', () => {
    expect(validatePassword('')).toBe(passwordLengthError);
  });

  it('should return localized error message when password is too short', () => {
    expect(validatePassword(textShortText)).toBe(passwordLengthError);
  });

  it('should return localized error message when password is too long', () => {
    expect(validatePassword(textTooLong)).toBe(passwordLengthError);
  });

  it("should return localized error message when password doesn't contain numbers", () => {
    expect(validatePassword(textNoNumbers)).toBe(passwordNumbersError);
  });

  it("should return localized error message when password doesn't contain uppercase letters", () => {
    expect(validatePassword(textNoUppercaseLetter)).toBe(passwordUppercaseError);
  });

  it('should return localized error message when password contains only numbers', () => {
    expect(validatePassword(onlyNumbers)).toBe(passwordUppercaseError);
  });

  it('should return localized error message when password contains only uppercase letters', () => {
    expect(validatePassword(onlyUppercase)).toBe(passwordNumbersError);
  });
});
