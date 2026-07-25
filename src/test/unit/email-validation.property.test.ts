/**
 * Property-based coverage for the email validators (#347).
 *
 * The example-based suite (email-validation.test.ts) checks a few fixed
 * addresses; these fast-check properties fuzz the full string space to prove
 * the validators are total (never throw, always return the documented shape)
 * and to pin the boundary contract (missing '@' is always rejected; a
 * well-formed address is always accepted).
 *
 * PR runs use 100 iterations; the nightly fuzz leg raises FC_NUM_RUNS.
 */
import fc from 'fast-check';

import { validateEmail } from '@landing/auth-section/validations';
import { isValidEmailFormat } from '@landing/auth-section/validations/email';

const numRuns: number = Number(process.env.FC_NUM_RUNS ?? 100);

// Non-empty ASCII-alphanumeric segments, guaranteed to satisfy the validator's
// `[^\s@]+` character class (no whitespace, no '@', no '.').
const emailSegment = fc
  .string({ minLength: 1, maxLength: 12 })
  .map((s: string): string => s.replace(/[^a-z0-9]/gi, ''))
  .filter((s: string): boolean => s.length > 0);

describe('email validation property tests', () => {
  it('isValidEmailFormat never throws and always returns a boolean', () => {
    expect(() =>
      fc.assert(
        fc.property(
          fc.string(),
          (input: string): boolean => typeof isValidEmailFormat(input) === 'boolean'
        ),
        { numRuns }
      )
    ).not.toThrow();
  });

  it('validateEmail never throws and returns true or a non-empty message', () => {
    expect(() =>
      fc.assert(
        fc.property(fc.string(), (input: string): boolean => {
          const result: string | boolean = validateEmail(input);
          return result === true || (typeof result === 'string' && result.length > 0);
        }),
        { numRuns }
      )
    ).not.toThrow();
  });

  it('rejects any input without an "@" as invalid', () => {
    expect(() =>
      fc.assert(
        fc.property(
          fc.string().filter((s: string): boolean => !s.includes('@')),
          (input: string): boolean => validateEmail(input) !== true
        ),
        { numRuns }
      )
    ).not.toThrow();
  });

  it('accepts a well-formed local@domain.tld address', () => {
    expect(() =>
      fc.assert(
        fc.property(
          emailSegment,
          emailSegment,
          emailSegment,
          (local: string, domain: string, tld: string): boolean => {
            const email: string = `${local}@${domain}.${tld}`;
            return isValidEmailFormat(email) && validateEmail(email) === true;
          }
        ),
        { numRuns }
      )
    ).not.toThrow();
  });
});
