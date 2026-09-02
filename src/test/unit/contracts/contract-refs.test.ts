import { readFileSync } from 'node:fs';

type RefsModule = typeof import('../../../../scripts/contracts/refs.mjs');

// The shape of the single user-service pin (#376). A committed digest only means
// something if the ref it attests to cannot move underneath it, so this rejects
// anything branch-shaped before a fetch, a vendor or a digest ever happens.
describe('user-service ref shape', () => {
  let refs: RefsModule;

  beforeAll(async () => {
    refs = await import('../../../../scripts/contracts/refs.mjs');
  });

  afterEach(() => {
    delete process.env.USER_SERVICE_VERSION;
  });

  describe('isImmutableRef', () => {
    test.each([
      ['a 40-character commit SHA', 'a'.repeat(40)],
      ['a mixed-hex commit SHA', '0f3373291abcdef0123456789abcdef012345678'],
      ['a release tag', 'v2.6.0'],
      ['a double-digit release tag', 'v12.30.400'],
      ['a pre-release tag', 'v2.6.0-rc.1'],
    ])('accepts %s', (_label, ref) => {
      expect(refs.isImmutableRef(ref)).toBe(true);
    });

    test.each([
      ['a default branch', 'main'],
      ['a long-lived branch', 'develop'],
      ['HEAD', 'HEAD'],
      ['a floating alias', 'latest'],
      ['a short SHA', '0f33732'],
      ['a 41-character string', 'a'.repeat(41)],
      ['an uppercase SHA', 'A'.repeat(40)],
      ['a partial version tag', 'v2.6'],
      ['a tag without the v prefix', '2.6.0'],
      ['an empty ref', ''],
      ['a branch that starts like a tag', 'v2.6.0-branch/feature'],
    ])('rejects %s', (_label, ref) => {
      expect(refs.isImmutableRef(ref)).toBe(false);
    });

    test('the pin committed in .env is accepted', () => {
      // Guards the guard: if this fails, either the pin moved to something that
      // floats or the pattern got too strict for a legitimate release tag.
      const line: string | undefined = readFileSync('.env', 'utf8')
        .split('\n')
        .find(entry => entry.startsWith('USER_SERVICE_VERSION='));

      expect(line).toBeDefined();
      expect(refs.isImmutableRef((line as string).split('=')[1]!.trim())).toBe(true);
    });
  });

  describe('requireImmutableUserServiceVersion', () => {
    test('returns the pin when it is immutable', () => {
      process.env.USER_SERVICE_VERSION = 'v2.6.0';

      expect(refs.requireImmutableUserServiceVersion()).toBe('v2.6.0');
    });

    test('throws when the pin is unset', () => {
      delete process.env.USER_SERVICE_VERSION;

      expect(() => refs.requireImmutableUserServiceVersion()).toThrow(
        'USER_SERVICE_VERSION is not set'
      );
    });

    test('throws when the pin is empty', () => {
      process.env.USER_SERVICE_VERSION = '';

      expect(() => refs.requireImmutableUserServiceVersion()).toThrow(
        'USER_SERVICE_VERSION is not set'
      );
    });

    // The point of checking here rather than only in the gate: a branch-shaped
    // pin used to be downloaded, vendored and digested successfully, and only
    // failed on the next `make lint-contracts`.
    test.each([['main'], ['develop'], ['HEAD'], ['0f33732']])(
      'throws before any fetch when the pin is %s',
      ref => {
        process.env.USER_SERVICE_VERSION = ref;

        expect(() => refs.requireImmutableUserServiceVersion()).toThrow('is not an immutable ref');
      }
    );
  });

  describe('immutableRefError', () => {
    test('names the offending ref and both accepted shapes', () => {
      const message: string = refs.immutableRefError('main');

      expect(message).toContain('"main"');
      expect(message).toContain('40-character');
      expect(message).toContain('vMAJOR.MINOR.PATCH');
    });
  });
});
