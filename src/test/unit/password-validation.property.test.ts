/**
 * Property-based coverage for `validatePassword` (#347).
 *
 * Fuzzes the full string space to prove the validator is total and to pin the
 * policy boundaries: anything shorter than the minimum is always rejected, and
 * a value that satisfies every rule is always accepted. Complements the
 * example-based password suite.
 *
 * PR runs use 100 iterations; the nightly fuzz leg raises FC_NUM_RUNS.
 */
import fc from 'fast-check';

import { validatePassword } from '@landing/auth-section/validations';

const numRuns: number = Number(process.env.FC_NUM_RUNS ?? 100);
const MIN_LENGTH = 8;
const MAX_LENGTH = 64;

describe('validatePassword property tests', () => {
  it('never throws and returns true or a non-empty error message', () => {
    expect(() =>
      fc.assert(
        fc.property(fc.string(), (input: string): boolean => {
          const result: string | boolean = validatePassword(input);
          return result === true || (typeof result === 'string' && result.length > 0);
        }),
        { numRuns }
      )
    ).not.toThrow();
  });

  it('rejects any value shorter than the minimum length', () => {
    expect(() =>
      fc.assert(
        fc.property(
          fc.string().filter((s: string): boolean => s.length < MIN_LENGTH),
          (input: string): boolean => validatePassword(input) !== true
        ),
        { numRuns }
      )
    ).not.toThrow();
  });

  it('accepts any value that satisfies every rule (length, digit, uppercase)', () => {
    expect(() =>
      fc.assert(
        fc.property(fc.string(), (filler: string): boolean => {
          // 'A' → uppercase rule, '1' → digit rule, padEnd/slice → length range.
          const password: string = `Aa1${filler}`.padEnd(MIN_LENGTH, 'x').slice(0, MAX_LENGTH);
          return validatePassword(password) === true;
        }),
        { numRuns }
      )
    ).not.toThrow();
  });
});
