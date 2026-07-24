import fc from 'fast-check';

import { validatePassword } from '../../features/landing/components/auth-section/validations';

const numRuns: number = Number(process.env.FC_NUM_RUNS ?? 100);

// A password is valid iff it is 8-64 chars long AND contains a digit AND
// contains an uppercase letter. Build strings that are valid by construction so
// the accept path is fuzzed, and derive the reject cases by removing one rule.
const validPassword: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 0, max: 9 }).map(String),
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc
      .string({ minLength: 6, maxLength: 62 })
      .map((filler: string) => filler.replace(/[^a-z]/g, 'a'))
  )
  .map(([digit, upper, filler]: [string, string, string]) => `${digit}${upper}${filler}`);

describe('password validation property tests', () => {
  it('always returns true or a non-empty error string, and never throws', () => {
    fc.assert(
      fc.property(fc.string(), (input: string) => {
        const result: string | boolean = validatePassword(input);
        return result === true || (typeof result === 'string' && result.length > 0);
      }),
      { numRuns }
    );
  });

  it('accepts every password that satisfies all three rules', () => {
    fc.assert(
      fc.property(validPassword, (password: string) => validatePassword(password) === true),
      { numRuns }
    );
  });

  it('rejects anything shorter than 8 characters', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 7 }), (input: string) => validatePassword(input) !== true),
      { numRuns }
    );
  });

  it('rejects passwords that contain no uppercase letter', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 64 }).map((input: string) => input.toLowerCase()),
        (input: string) => validatePassword(input) !== true
      ),
      { numRuns }
    );
  });
});
