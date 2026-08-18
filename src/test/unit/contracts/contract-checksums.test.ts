import { readFileSync } from 'node:fs';

// Types come from the declaration shim next to the script
// (scripts/contracts/checksums.d.mts) rather than a hand-copied duplicate, so the
// spec cannot drift from the module's exported surface.
type ChecksumsModule = typeof import('../../../../scripts/contracts/checksums.mjs');
type ReadFile = Parameters<ChecksumsModule['verifyCommittedDigests']>[0] & object;

// Digests of the vendored user-service contracts (#376). The committed artifacts
// are the trust anchor for the swagger page, the Mockoon fixture and the Apollo
// mock, so this covers both directions: a recorded digest that no longer matches
// its artifact, and an artifact with no digest at all.
describe('contract checksums', () => {
  let checksums: ChecksumsModule;

  const SDL: string = 'type Query { user: String }\n';

  const fakeFiles = (overrides: Record<string, string> = {}): ReadFile => {
    const files: Record<string, string> = {
      'contracts/user-service/openapi.json': JSON.stringify({ openapi: '3.0.0', paths: {} }),
      'contracts/user-service/schema.graphql': SDL,
      ...overrides,
    };

    return (path: string) => {
      const content: string | undefined = files[path];
      if (content === undefined) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }
      return content;
    };
  };

  const withChecksums = (
    artifacts: Record<string, string>,
    overrides: Record<string, string> = {},
    algorithm: string = 'sha256'
  ): ReadFile =>
    fakeFiles({
      'contracts/user-service/checksums.json': JSON.stringify({ algorithm, artifacts }),
      ...overrides,
    });

  beforeAll(async () => {
    checksums = await import('../../../../scripts/contracts/checksums.mjs');
  });

  describe('digest', () => {
    test('is a 64-character lowercase sha256 hex string', () => {
      expect(checksums.digest('vilna')).toMatch(/^[0-9a-f]{64}$/);
    });

    test('is stable for equal input and different for different input', () => {
      expect(checksums.digest('vilna')).toBe(checksums.digest('vilna'));
      expect(checksums.digest('vilna')).not.toBe(checksums.digest('vilnb'));
    });

    test('distinguishes an empty string from whitespace', () => {
      expect(checksums.digest('')).not.toBe(checksums.digest(' '));
    });
  });

  describe('canonicalization', () => {
    // The digest is taken over the parsed document precisely so Prettier, which
    // owns the committed file's formatting, cannot invalidate it.
    test('ignores JSON whitespace', () => {
      const compact: string = '{"openapi":"3.0.0","paths":{}}';
      const pretty: string = JSON.stringify(JSON.parse(compact), null, 2);

      expect(checksums.openapiDigestFromJson(pretty)).toBe(
        checksums.openapiDigestFromJson(compact)
      );
    });

    test('still notices a changed value', () => {
      expect(checksums.openapiDigestFromJson('{"openapi":"3.0.0"}')).not.toBe(
        checksums.openapiDigestFromJson('{"openapi":"3.1.0"}')
      );
    });

    test('notices reordered keys, because JSON key order is preserved', () => {
      expect(checksums.openapiDigestFromJson('{"a":1,"b":2}')).not.toBe(
        checksums.openapiDigestFromJson('{"b":2,"a":1}')
      );
    });

    test('applies the same null-keyword normalization the drift check applies', () => {
      // `maxLength: null` is dropped at ingestion, so a YAML document carrying it
      // and the committed JSON without it must produce one digest.
      expect(checksums.openapiDigestFromYaml('openapi: "3.0.0"\nmaxLength: null\n')).toBe(
        checksums.openapiDigestFromJson('{"openapi":"3.0.0"}')
      );
    });

    test('a YAML document and its committed JSON artifact agree', () => {
      expect(checksums.openapiDigestFromYaml('openapi: "3.0.0"\npaths: {}\n')).toBe(
        checksums.openapiDigestFromJson('{"openapi":"3.0.0","paths":{}}')
      );
    });

    test('canonicalizeOpenapiDocument re-serializes the parsed document', () => {
      expect(checksums.canonicalizeOpenapiDocument({ openapi: '3.0.0' })).toBe(
        '{"openapi":"3.0.0"}'
      );
    });

    test('the GraphQL SDL is hashed verbatim', () => {
      expect(checksums.graphqlDigest(SDL)).toBe(checksums.digest(SDL));
      expect(checksums.graphqlDigest(SDL)).not.toBe(checksums.graphqlDigest(SDL.trim()));
    });
  });

  describe('readChecksums', () => {
    test('returns the recorded artifact map', () => {
      const read: ReadFile = withChecksums({ 'contracts/user-service/openapi.json': 'abc' });

      expect(checksums.readChecksums(read)).toEqual({
        'contracts/user-service/openapi.json': 'abc',
      });
    });

    test('rejects a checksums file recorded with another algorithm', () => {
      const read: ReadFile = withChecksums({}, {}, 'md5');

      expect(() => checksums.readChecksums(read)).toThrow('unsupported algorithm "md5"');
    });

    test('rejects a checksums file with no artifacts object', () => {
      const read: ReadFile = fakeFiles({
        'contracts/user-service/checksums.json': JSON.stringify({ algorithm: 'sha256' }),
      });

      expect(() => checksums.readChecksums(read)).toThrow('missing an "artifacts" object');
    });

    test('rejects an artifacts value that is not an object', () => {
      const read: ReadFile = fakeFiles({
        'contracts/user-service/checksums.json': JSON.stringify({
          algorithm: 'sha256',
          artifacts: 'none',
        }),
      });

      expect(() => checksums.readChecksums(read)).toThrow('missing an "artifacts" object');
    });

    test('propagates a missing checksums file', () => {
      expect(() => checksums.readChecksums(fakeFiles())).toThrow('ENOENT');
    });
  });

  describe('verifyCommittedDigests', () => {
    test('reports nothing when every artifact matches', () => {
      const read: ReadFile = fakeFiles();
      const expected: Record<string, string> = checksums.computeCommittedDigests(read);

      expect(checksums.verifyCommittedDigests(withChecksums(expected))).toEqual([]);
    });

    test('reports the artifact whose digest changed', () => {
      const read: ReadFile = fakeFiles();
      const expected: Record<string, string> = checksums.computeCommittedDigests(read);
      const tampered: ReadFile = withChecksums(expected, {
        'contracts/user-service/schema.graphql': `${SDL}type Injected { x: String }\n`,
      });

      const problems: string[] = checksums.verifyCommittedDigests(tampered);

      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('contracts/user-service/schema.graphql');
      expect(problems[0]).toContain('make update-contracts');
    });

    test('reports every mismatching artifact, not just the first', () => {
      const read: ReadFile = fakeFiles();
      const expected: Record<string, string> = checksums.computeCommittedDigests(read);
      const tampered: ReadFile = withChecksums(expected, {
        'contracts/user-service/openapi.json': JSON.stringify({ openapi: '3.1.0' }),
        'contracts/user-service/schema.graphql': 'type Query { injected: String }\n',
      });

      expect(checksums.verifyCommittedDigests(tampered)).toHaveLength(2);
    });

    test('reports an artifact with no recorded digest at all', () => {
      const read: ReadFile = fakeFiles();
      const partial: Record<string, string> = checksums.computeCommittedDigests(read);
      delete partial[checksums.SCHEMA_ARTIFACT];

      const problems: string[] = checksums.verifyCommittedDigests(withChecksums(partial));

      expect(problems).toEqual([
        `${checksums.SCHEMA_ARTIFACT}: no digest recorded in ${checksums.CHECKSUMS_PATH}`,
      ]);
    });

    test('an extra recorded digest for an unknown artifact is not a failure', () => {
      const read: ReadFile = fakeFiles();
      const expected: Record<string, string> = {
        ...checksums.computeCommittedDigests(read),
        'contracts/user-service/retired.json': 'deadbeef',
      };

      expect(checksums.verifyCommittedDigests(withChecksums(expected))).toEqual([]);
    });
  });

  describe('buildChecksumsFile', () => {
    test('records the algorithm and one digest per artifact', () => {
      const built: ReturnType<ChecksumsModule['buildChecksumsFile']> =
        checksums.buildChecksumsFile(fakeFiles());

      expect(built.algorithm).toBe(checksums.ALGORITHM);
      expect(Object.keys(built.artifacts)).toEqual([
        checksums.OPENAPI_ARTIFACT,
        checksums.SCHEMA_ARTIFACT,
      ]);
      expect(built.comment).toContain('make update-contracts');
    });

    test('round-trips: what it writes is what verification accepts', () => {
      const read: ReadFile = fakeFiles();
      const built: ReturnType<ChecksumsModule['buildChecksumsFile']> =
        checksums.buildChecksumsFile(read);

      expect(
        checksums.verifyCommittedDigests(
          fakeFiles({ 'contracts/user-service/checksums.json': JSON.stringify(built) })
        )
      ).toEqual([]);
    });
  });

  // The gate is only worth anything if it is green against the artifacts actually
  // committed here — including after Prettier has reformatted them.
  describe('the committed contracts', () => {
    test('match the digests recorded in contracts/user-service/checksums.json', () => {
      expect(checksums.verifyCommittedDigests()).toEqual([]);
    });

    test('are recorded with sha256', () => {
      const recorded: { algorithm: string } = JSON.parse(
        readFileSync(checksums.CHECKSUMS_PATH, 'utf8')
      );

      expect(recorded.algorithm).toBe('sha256');
    });
  });
});
