import fc from 'fast-check';

import normalizeLink from '../../features/landing/helpers/normalizeLink';

// Property-based (fuzz) coverage for the input-shape defect class behind the
// CloudFront path incidents (#226/#229/#249): unusual, encoded, and hostile
// strings hitting a parser. Example-based tests enumerate a handful of cases;
// these enumerate the input space. On PR the run count stays small (fast); the
// nightly `make test-fuzz` leg re-runs the same properties at FC_NUM_RUNS.
const numRuns: number = Number(process.env.FC_NUM_RUNS ?? 100);

describe('normalizeLink property tests', () => {
  it('always returns a string and never throws', () => {
    fc.assert(
      fc.property(fc.string(), (input: string) => typeof normalizeLink(input) === 'string'),
      { numRuns }
    );
  });

  it('output is always lowercase', () => {
    fc.assert(
      fc.property(fc.string(), (input: string) => {
        const output: string = normalizeLink(input);
        return output === output.toLowerCase();
      }),
      { numRuns }
    );
  });

  it('is idempotent on inputs without a leading hash', () => {
    fc.assert(
      fc.property(
        fc.string().filter((input: string) => !input.startsWith('#')),
        (input: string) => {
          const once: string = normalizeLink(input);
          return normalizeLink(once) === once;
        }
      ),
      { numRuns }
    );
  });

  it('removes exactly one leading hash', () => {
    fc.assert(
      fc.property(
        fc.string().filter((input: string) => !input.startsWith('#')),
        (input: string) => normalizeLink(`#${input}`) === normalizeLink(input)
      ),
      { numRuns }
    );
  });
});
