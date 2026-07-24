/**
 * Property-based coverage for `normalizeLink` (#347).
 *
 * Example-based tests (see normalizeLink.test.ts) pin a handful of hand-picked
 * inputs; these fast-check properties enumerate the whole string space — the
 * input-shape class behind the CloudFront path incidents (#226/#229/#249) —
 * asserting the invariants hold for hostile unicode, empty/boundary strings,
 * and arbitrary fragments.
 *
 * The PR unit job runs the default 100 runs (sub-second); the nightly fuzz leg
 * (`make test-fuzz` in fuzz-testing.yml) raises FC_NUM_RUNS to 100000.
 */
import fc from 'fast-check';

import normalizeLink from '../../features/landing/helpers/normalizeLink';

const numRuns: number = Number(process.env.FC_NUM_RUNS ?? 100);

describe('normalizeLink property tests', () => {
  it('never throws and always returns a fully lowercased string', () => {
    expect(() =>
      fc.assert(
        fc.property(fc.string(), (input: string): boolean => {
          const result: string = normalizeLink(input);
          return typeof result === 'string' && result === result.toLowerCase();
        }),
        { numRuns }
      )
    ).not.toThrow();
  });

  it('lowercases inputs that have no leading hash without altering them otherwise', () => {
    // Scoped to inputs with no leading '#': the strip is then a no-op, so the
    // result must equal the lowercased input. The general case only removes a
    // single leading '#' ("##a" -> "#a"), which is why this is guarded.
    expect(() =>
      fc.assert(
        fc.property(
          fc.string().filter((s: string): boolean => !s.startsWith('#')),
          (input: string): boolean => normalizeLink(input) === input.toLowerCase()
        ),
        { numRuns }
      )
    ).not.toThrow();
  });

  it('strips exactly one leading hash, then lowercases the remainder', () => {
    expect(() =>
      fc.assert(
        fc.property(
          fc.string().filter((s: string): boolean => !s.startsWith('#')),
          (rest: string): boolean => normalizeLink(`#${rest}`) === rest.toLowerCase()
        ),
        { numRuns }
      )
    ).not.toThrow();
  });

  it('is idempotent on generated URLs', () => {
    expect(() =>
      fc.assert(
        fc.property(fc.webUrl(), (url: string): boolean => {
          const once: string = normalizeLink(url);
          return normalizeLink(once) === once;
        }),
        { numRuns }
      )
    ).not.toThrow();
  });
});
