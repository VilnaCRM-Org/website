import { validateFullName } from '../../features/landing/components/AuthSection/Validations';
import {
  validators,
  validationMessages,
} from '../../features/landing/components/AuthSection/Validations/initials';

const testFullName: string = 'John Doe';
const testFirstName: string = 'John';
const testSecondName: string = 'Doe';

describe('initials Tests', () => {
  describe('validators', () => {
    it('should correctly validate formatted strings and letters-only errors', () => {
      expect(validators.isFormatted(testFullName)).toBe(true);
      expect(validators.isFormatted(`!@${testFullName} #%`)).toBe(false);
      expect(validators.isFormatted(`123 ${testFullName}456`)).toBe(false);
      expect(validators.isFormatted(`${testFirstName} ${testSecondName}`)).toBe(true);

      expect(validators.isLettersOnlyError(testFullName)).toBe(true);
      expect(validators.isLettersOnlyError(`!@${testFullName} #%`)).toBe(false);
      expect(validators.isLettersOnlyError(`123 ${testFullName}456`)).toBe(false);
      expect(validators.isLettersOnlyError(`${testFirstName} ${testSecondName}`)).toBe(true);
    });
  });

  describe('validateFullName', () => {
    it('should return null if the full name is valid', () => {
      expect(validateFullName(testFullName)).toBe(null);
      expect(validateFullName(`  ${testFullName}  `)).toBe(null);
      expect(validateFullName(`${testFirstName} ${testSecondName}`)).toBe(null);
    });

    it('should return an error message for invalid full names', () => {
      expect(validateFullName(`!@${testFullName} #%`)).toBe(validationMessages.lettersOnlyError);
      expect(validateFullName(`123 ${testFullName}456`)).toBe(validationMessages.lettersOnlyError);
      expect(validateFullName(`123 456 789`)).toBe(validationMessages.lettersOnlyError);
      expect(validateFullName(`!@# $%^ &*()`)).toBe(validationMessages.lettersOnlyError);
    });

    it('should return a required error message for empty or whitespace-only strings', () => {
      expect(validateFullName(``)).toBe(validationMessages.required);
      expect(validateFullName(`  `)).toBe(validationMessages.required);
      expect(validateFullName(`\n`)).toBe(validationMessages.required);
      expect(validateFullName(` \n `)).toBe(validationMessages.required);
    });

    it('should return a format error message if the full name is too long', () => {
      expect(validateFullName(testFullName.repeat(150))).toBe(validationMessages.formatError);
    });
  });
});
