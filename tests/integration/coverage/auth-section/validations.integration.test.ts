/**
 * Integration coverage: AuthSection field validators.
 *
 * Exercises the real i18n-backed validators (`validateEmail`, `validatePassword`,
 * `validateFullName`) together with their helper predicates so every branch of
 * the format/length/letters-only rules executes. The validators read messages
 * from the live i18next instance bootstrapped in `jest.setup.ts`.
 */
import { t } from 'i18next';

import {
  validateEmail,
  validateFullName,
  validatePassword,
} from '../../../../src/features/landing/components/AuthSection/Validations';
import { isValidEmailFormat } from '../../../../src/features/landing/components/AuthSection/Validations/email';
import {
  validators,
  validationMessages,
} from '../../../../src/features/landing/components/AuthSection/Validations/initials';

const emailFormatError: string = t('sign_up.form.email_input.email_format_error');
const emailInvalidError: string = t('sign_up.form.email_input.invalid_message');

const passwordLengthError: string = t('sign_up.form.password_input.error_length');
const passwordNumbersError: string = t('sign_up.form.password_input.error_numbers');
const passwordUppercaseError: string = t('sign_up.form.password_input.error_uppercase');

describe('integration: AuthSection validators', () => {
  describe('isValidEmailFormat', () => {
    it('accepts well-formed addresses', () => {
      expect(isValidEmailFormat('valid.user@example.com')).toBe(true);
      expect(isValidEmailFormat('user@example-domain.com')).toBe(true);
    });

    it('rejects malformed addresses', () => {
      expect(isValidEmailFormat('user@domain')).toBe(false);
      expect(isValidEmailFormat('user@.com')).toBe(false);
      expect(isValidEmailFormat('prefix user@example.com')).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('returns true for a valid email', () => {
      expect(validateEmail('valid.user@example.com')).toBe(true);
    });

    it('returns the format error when the value lacks "@" or "."', () => {
      expect(validateEmail('test@example')).toBe(emailFormatError);
      expect(validateEmail('test.example')).toBe(emailFormatError);
      expect(validateEmail('')).toBe(emailFormatError);
    });

    it('returns the invalid-message error when "@" and "." exist but the shape is wrong', () => {
      expect(validateEmail('test@example.')).toBe(emailInvalidError);
      expect(validateEmail('@domain.com')).toBe(emailInvalidError);
      expect(validateEmail('user@example.com suffix')).toBe(emailInvalidError);
    });
  });

  describe('validatePassword', () => {
    it('returns true for a valid password and boundary lengths', () => {
      expect(validatePassword('ValidPassword123')).toBe(true);
      expect(validatePassword('Abcdefg1')).toBe(true);
      expect(validatePassword(`A1${'b'.repeat(62)}`)).toBe(true);
    });

    it('returns the length error when too short or too long', () => {
      expect(validatePassword('Abc123')).toBe(passwordLengthError);
      expect(validatePassword(`A1${'b'.repeat(63)}`)).toBe(passwordLengthError);
    });

    it('returns the numbers error when no digit present', () => {
      expect(validatePassword('PasswordOnly')).toBe(passwordNumbersError);
    });

    it('returns the uppercase error when no uppercase letter present', () => {
      expect(validatePassword('password1')).toBe(passwordUppercaseError);
    });
  });

  describe('validateFullName', () => {
    it('returns null for valid full names (trimmed and untrimmed)', () => {
      expect(validateFullName('John Doe')).toBe(null);
      expect(validateFullName('  John Doe  ')).toBe(null);
    });

    it('returns the required message for empty or whitespace-only input', () => {
      expect(validateFullName('')).toBe(validationMessages.required);
      expect(validateFullName('   ')).toBe(validationMessages.required);
    });

    it('returns the letters-only error for non-letter characters', () => {
      expect(validateFullName('!@John Doe #%')).toBe(validationMessages.lettersOnlyError);
      expect(validateFullName('123 456 789')).toBe(validationMessages.lettersOnlyError);
    });

    it('returns the format error for letters-only but badly-formatted input', () => {
      expect(validateFullName('John')).toBe(validationMessages.formatError);
      expect(validateFullName('John Doe'.repeat(150))).toBe(validationMessages.formatError);
    });

    it('exposes predicate validators directly', () => {
      expect(validators.isFormatted('John Doe')).toBe(true);
      expect(validators.isFormatted('123 John456')).toBe(false);
      expect(validators.isLettersOnly('John Doe')).toBe(true);
      expect(validators.isLettersOnly('!@John')).toBe(false);
      expect(validators.isEmpty('   ')).toBe(true);
      expect(validators.isEmpty('John')).toBe(false);
    });
  });
});
