import i18n from 'i18next';

import { validateFullName } from '../../features/landing/components/auth-section/validations';
import {
  validators,
  validationMessages,
} from '../../features/landing/components/auth-section/validations/initials';
import en from '../../features/landing/i18n/en.json';
import uk from '../../features/landing/i18n/uk.json';

const testFullName: string = 'John Doe';
const testFirstName: string = 'John';
const testSecondName: string = 'Doe';
// Mirrors MAX_INITIALS_LENGTH in the validator: two names around one space.
const maxInitialsLength: number = 255;
const longestValidFullName: string = `${'a'.repeat(127)} ${'b'.repeat(127)}`;
const tooLongFullName: string = `${'a'.repeat(128)} ${'b'.repeat(127)}`;

describe('initials Tests', () => {
  describe('validators', () => {
    it('should correctly validate formatted strings and letters-only errors', () => {
      expect(validators.isFormatted(testFullName)).toBe(true);
      expect(validators.isFormatted(`!@${testFullName} #%`)).toBe(false);
      expect(validators.isFormatted(`123 ${testFullName}456`)).toBe(false);
      expect(validators.isFormatted(`${testFirstName} ${testSecondName}`)).toBe(true);

      expect(validators.isLettersOnly(testFullName)).toBe(true);
      expect(validators.isLettersOnly(`!@${testFullName} #%`)).toBe(false);
      expect(validators.isLettersOnly(`123 ${testFullName}456`)).toBe(false);
      expect(validators.isLettersOnly(`${testFirstName} ${testSecondName}`)).toBe(true);
    });

    it('rejects a disallowed character at either end alone (both patterns are anchored)', () => {
      // A single stray character at only one end is what an unanchored pattern
      // lets through: without `^` the trailing "John Doe" still matches, and
      // without `$` the leading one does.
      expect(validators.isLettersOnly(`1${testFullName}`)).toBe(false);
      expect(validators.isLettersOnly(`${testFullName}1`)).toBe(false);
      expect(validators.isFormatted(`1${testFullName}`)).toBe(false);
      expect(validators.isFormatted(`${testFullName}1`)).toBe(false);
    });

    it('accepts a full name of exactly the maximum length and rejects one character more', () => {
      expect(longestValidFullName).toHaveLength(maxInitialsLength);
      expect(validators.isFormatted(longestValidFullName)).toBe(true);
      expect(validators.isFormatted(tooLongFullName)).toBe(false);
    });

    it('treats a whitespace-only value as empty', () => {
      expect(validators.isEmpty('')).toBe(true);
      expect(validators.isEmpty('   ')).toBe(true);
      expect(validators.isEmpty(' \n\t ')).toBe(true);
      expect(validators.isEmpty(testFirstName)).toBe(false);
    });
  });

  describe('validationMessages', () => {
    it('resolves every message from the active locale bundle, never an empty string', () => {
      // Comparing validateFullName() against validationMessages.* alone is
      // self-referential: a message mutated to '' would still equal itself, and
      // comparing against t() again would pass for a missing key too, because
      // i18next echoes the key. The committed bundle is the reference instead.
      const nameInput: typeof en.sign_up.form.name_input = (i18n.language === 'en' ? en : uk)
        .sign_up.form.name_input;

      expect(validationMessages).toEqual({
        formatError: nameInput.full_name_format_error,
        lettersOnlyError: nameInput.special_characters_error,
        required: nameInput.required,
      });
      Object.values(validationMessages).forEach(message => {
        expect(message.trim()).not.toHaveLength(0);
      });
    });
  });

  describe('validateFullName', () => {
    it('should return null if the full name is valid', () => {
      expect(validateFullName(testFullName)).toBe(null);
      expect(validateFullName(`  ${testFullName}  `)).toBe(null);
      expect(validateFullName(`${testFirstName} ${testSecondName}`)).toBe(null);
      expect(validateFullName(longestValidFullName)).toBe(null);
    });

    it('should return an error message for invalid full names', () => {
      expect(validateFullName(`!@${testFullName} #%`)).toBe(validationMessages.lettersOnlyError);
      expect(validateFullName(`123 ${testFullName}456`)).toBe(validationMessages.lettersOnlyError);
      expect(validateFullName(`123 456 789`)).toBe(validationMessages.lettersOnlyError);
      expect(validateFullName(`!@# $%^ &*()`)).toBe(validationMessages.lettersOnlyError);
      expect(validateFullName(`1${testFullName}`)).toBe(validationMessages.lettersOnlyError);
      expect(validateFullName(`${testFullName}1`)).toBe(validationMessages.lettersOnlyError);
    });

    it('should return a required error message for empty or whitespace-only strings', () => {
      expect(validateFullName(``)).toBe(validationMessages.required);
      expect(validateFullName(`  `)).toBe(validationMessages.required);
      expect(validateFullName(`\n`)).toBe(validationMessages.required);
      expect(validateFullName(` \n `)).toBe(validationMessages.required);
    });

    it('should return a format error message if the full name is too long', () => {
      expect(validateFullName(testFullName.repeat(150))).toBe(validationMessages.formatError);
      expect(validateFullName(tooLongFullName)).toBe(validationMessages.formatError);
    });
  });
});
