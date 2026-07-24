import fc from 'fast-check';

import { validateEmail } from '@landing/auth-section/validations';
import { isValidEmailFormat } from '@landing/auth-section/validations/email';

const numRuns: number = Number(process.env.FC_NUM_RUNS ?? 100);

describe('email validation property tests', () => {
  it('isValidEmailFormat always returns a boolean and never throws', () => {
    fc.assert(
      fc.property(fc.string(), (input: string) => typeof isValidEmailFormat(input) === 'boolean'),
      { numRuns }
    );
  });

  it('strings without an "@" are never a valid format', () => {
    fc.assert(
      fc.property(
        fc.string().filter((input: string) => !input.includes('@')),
        (input: string) => isValidEmailFormat(input) === false
      ),
      { numRuns }
    );
  });

  it('validateEmail passes exactly when the format is valid', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (input: string) => (validateEmail(input) === true) === isValidEmailFormat(input)
      ),
      { numRuns }
    );
  });

  it('validateEmail always returns true or a non-empty error string', () => {
    fc.assert(
      fc.property(fc.string(), (input: string) => {
        const result: string | boolean = validateEmail(input);
        return result === true || (typeof result === 'string' && result.length > 0);
      }),
      { numRuns }
    );
  });
});
