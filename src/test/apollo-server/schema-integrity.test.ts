import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  CHECKSUMS_PATH,
  SCHEMA_ARTIFACT,
  SchemaIntegrityError,
  assertSchemaIntegrity,
  locateChecksums,
  readExpectedSchemaDigest,
  sha256,
} from '../../../docker/apollo-server/schemaIntegrity';

const CHECKSUMS_RELATIVE_SUFFIX: string = path.join('contracts', 'user-service', 'checksums.json');

const SDL: string = 'type Query { user: String }\n';
const SDL_DIGEST: string = createHash('sha256').update(SDL, 'utf8').digest('hex');

const write = (dir: string, body: unknown): string => {
  const file: string = path.join(dir, 'checksums.json');
  fs.writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body), 'utf-8');
  return file;
};

// The Apollo mock re-downloads the GraphQL schema from a mutable git tag on every
// container start and overwrites the vendored copy Apollo.Dockerfile seeded. This
// is the check that makes a moved tag loud instead of silent (#376 F3).
describe('apollo mock schema integrity', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-integrity-'));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  describe('sha256', () => {
    test('matches the digest recorded for the committed artifact', () => {
      expect(sha256(SDL)).toBe(SDL_DIGEST);
    });

    test('changes when a single character changes', () => {
      expect(sha256(SDL)).not.toBe(sha256(SDL.replace('user', 'users')));
    });
  });

  describe('readExpectedSchemaDigest', () => {
    test('returns the digest recorded for the GraphQL artifact', () => {
      const file: string = write(workDir, {
        algorithm: 'sha256',
        artifacts: { [SCHEMA_ARTIFACT]: SDL_DIGEST },
      });

      expect(readExpectedSchemaDigest(file)).toBe(SDL_DIGEST);
    });

    test('returns null when the checksums file is missing', () => {
      expect(readExpectedSchemaDigest(path.join(workDir, 'absent.json'))).toBeNull();
    });

    test('returns null when the checksums file is not valid JSON', () => {
      expect(readExpectedSchemaDigest(write(workDir, '{ not json'))).toBeNull();
    });

    test('returns null when the file records no artifacts', () => {
      expect(readExpectedSchemaDigest(write(workDir, { algorithm: 'sha256' }))).toBeNull();
    });

    test('returns null when the GraphQL artifact has no entry', () => {
      const file: string = write(workDir, {
        algorithm: 'sha256',
        artifacts: { 'contracts/user-service/openapi.json': SDL_DIGEST },
      });

      expect(readExpectedSchemaDigest(file)).toBeNull();
    });

    test('defaults to the checksums file that ships alongside the contracts', () => {
      // Located by walking up from the module, not from the process cwd, so the
      // mock finds `contracts/` wherever it is started from — and at whichever
      // depth it was compiled to.
      expect(
        CHECKSUMS_PATH.endsWith(path.join('contracts', 'user-service', 'checksums.json'))
      ).toBe(true);
      expect(path.isAbsolute(CHECKSUMS_PATH)).toBe(true);
      expect(fs.existsSync(CHECKSUMS_PATH)).toBe(true);
    });
  });

  describe('locateChecksums', () => {
    test('finds the file at the depth the image compiles to', () => {
      // out/docker/apollo-server/ -> /app, three levels up.
      const root: string = fs.mkdtempSync(path.join(os.tmpdir(), 'app-'));
      const nested: string = path.join(root, 'out', 'docker', 'apollo-server');
      fs.mkdirSync(nested, { recursive: true });
      fs.mkdirSync(path.join(root, 'contracts', 'user-service'), { recursive: true });
      const target: string = path.join(root, 'contracts', 'user-service', 'checksums.json');
      fs.writeFileSync(target, '{}', 'utf-8');

      try {
        expect(locateChecksums(nested)).toBe(target);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

    test('finds the file at the depth the source tree uses', () => {
      const root: string = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'));
      const nested: string = path.join(root, 'docker', 'apollo-server');
      fs.mkdirSync(nested, { recursive: true });
      fs.mkdirSync(path.join(root, 'contracts', 'user-service'), { recursive: true });
      const target: string = path.join(root, 'contracts', 'user-service', 'checksums.json');
      fs.writeFileSync(target, '{}', 'utf-8');

      try {
        expect(locateChecksums(nested)).toBe(target);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

    test('falls back to a named path when no contracts directory is above it', () => {
      const orphan: string = path.join(workDir, 'a', 'b', 'c');
      fs.mkdirSync(orphan, { recursive: true });

      const located: string = locateChecksums(orphan);

      expect(located).toBe(path.join(workDir, CHECKSUMS_RELATIVE_SUFFIX));
      expect(fs.existsSync(located)).toBe(false);
    });
  });

  describe('assertSchemaIntegrity', () => {
    test('accepts a download that matches the pinned contract', () => {
      expect(() => assertSchemaIntegrity(SDL, SDL_DIGEST)).not.toThrow();
    });

    test('rejects a download whose digest differs', () => {
      const tampered: string = `${SDL}type Injected { secret: String }\n`;

      expect(() => assertSchemaIntegrity(tampered, SDL_DIGEST)).toThrow(SchemaIntegrityError);
      expect(() => assertSchemaIntegrity(tampered, SDL_DIGEST)).toThrow(
        'does not match the pinned contract'
      );
    });

    test('names both digests so the mismatch is diagnosable', () => {
      const tampered: string = 'type Query { injected: String }\n';

      expect(() => assertSchemaIntegrity(tampered, SDL_DIGEST)).toThrow(sha256(tampered));
      expect(() => assertSchemaIntegrity(tampered, SDL_DIGEST)).toThrow(SDL_DIGEST);
    });

    test('rejects whitespace-only drift, because the SDL is vendored verbatim', () => {
      expect(() => assertSchemaIntegrity(SDL.trim(), SDL_DIGEST)).toThrow(SchemaIntegrityError);
    });

    test('rejects an empty download', () => {
      expect(() => assertSchemaIntegrity('', SDL_DIGEST)).toThrow(SchemaIntegrityError);
    });

    // Fail closed: no recorded digest means the download cannot be verified, so it
    // must not replace the reviewed copy the image was seeded with.
    test('rejects any download when no digest is recorded', () => {
      expect(() => assertSchemaIntegrity(SDL, null)).toThrow(SchemaIntegrityError);
      expect(() => assertSchemaIntegrity(SDL, null)).toThrow('No digest recorded');
    });

    test('reports a SchemaIntegrityError by name', () => {
      try {
        assertSchemaIntegrity('', SDL_DIGEST);
        throw new Error('expected assertSchemaIntegrity to throw');
      } catch (error) {
        expect((error as Error).name).toBe('SchemaIntegrityError');
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('against the committed contract', () => {
    // SCHEMA_ARTIFACT is a key in the checksums map, not a filesystem path, so it
    // is resolved next to the located checksums file rather than against the Jest
    // working directory — otherwise these two tests would pass or fail based on
    // where the runner was started.
    const vendoredSchema = (): string =>
      fs.readFileSync(path.resolve(path.dirname(CHECKSUMS_PATH), 'schema.graphql'), 'utf-8');

    test('the vendored schema passes its own recorded digest', () => {
      expect(() =>
        assertSchemaIntegrity(vendoredSchema(), readExpectedSchemaDigest())
      ).not.toThrow();
    });

    test('appending one line to the vendored schema fails the check', () => {
      expect(() =>
        assertSchemaIntegrity(
          `${vendoredSchema()}type Backdoor { token: String }\n`,
          readExpectedSchemaDigest()
        )
      ).toThrow(SchemaIntegrityError);
    });
  });
});
