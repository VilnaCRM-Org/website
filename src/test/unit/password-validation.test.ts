import { faker } from '@faker-js/faker';
import { t } from 'i18next';

import { validatePassword } from '../../features/landing/components/AuthSection/Validations';

const textShortText: string = faker.internet.password({
  length: 7,
});

const textNoNumbers: string = faker.internet.password({
  length: 10,
  pattern: /[A-Z]/,
});
const textNoUppercaseLetter: string = faker.internet.password({
  length: 10,
  pattern: /[a-z]/,
  prefix: '1',
});

const correctPassword: string = faker.internet.password({
  length: 16,
  prefix: 'Q9',
});

const passwordLengthError: string = t('sign_up.form.password_input.error_length');
const passwordNumbersError: string = t('sign_up.form.password_input.error_numbers');
const passwordUppercaseError: string = t('sign_up.form.password_input.error_uppercase');

describe('code snippet', () => {
  it('should return true when password is valid', () => {
    const result: string | boolean = validatePassword(correctPassword);
    expect(result).toBe(true);
  });

  it('should return localized error message when password is empty', () => {
    const result: string | boolean = validatePassword('');
    expect(result).toBe(passwordLengthError);
  });

  it('should return localized error message when password is too short', () => {
    const result: string | boolean = validatePassword(textShortText);
    expect(result).toBe(passwordLengthError);
  });

  it("should return localized error message when password doesn't contain numbers", () => {
    const result: string | boolean = validatePassword(textNoNumbers);
    expect(result).toBe(passwordNumbersError);
  });

  it('should return localized error message when password is too short', () => {
    const result: string | boolean = validatePassword(textNoUppercaseLetter);
    expect(result).toBe(passwordUppercaseError);
  });
});
