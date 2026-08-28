import fs from 'node:fs';

/**
 * Covers the REAL `scripts/patchSwaggerServer.mjs` — the script the Docker build
 * runs to produce `public/swagger-schema.json`, the document `/swagger` renders.
 *
 * This suite previously re-implemented the script's functions inside the spec and
 * asserted against those copies, so it could not fail when the script changed.
 * Issue #381 (F4) needs the opposite: the version stamping must be verified on the
 * shipped code path.
 *
 * Scenario classes: positive (server URL patched, pinned version stamped), negative
 * (missing env var, unreadable or malformed contract), boundary (no `servers`, a
 * non-array `servers`, missing `info`).
 *
 * Locale / responsive / a11y — Not applicable: a build-time transform of a JSON
 * document; the rendered page is covered by the swagger e2e and visual suites.
 */

jest.mock('dotenv/config', () => ({}), { virtual: true });
jest.mock('dotenv', () => ({ config: jest.fn(() => ({ parsed: {} })) }));
jest.mock('dotenv-expand', () => ({ expand: jest.fn() }));
jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

const mockReadFileSync: jest.MockedFunction<typeof fs.readFileSync> = jest.mocked(fs.readFileSync);
const mockWriteFileSync: jest.MockedFunction<typeof fs.writeFileSync> = jest.mocked(
  fs.writeFileSync
);

const mockExit: jest.SpyInstance = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit was called');
});
// The script writes to the standard streams directly (it is a build-time CLI, so
// `console` is reserved for — and linted as — stray application logging).
const mockStderr: jest.SpyInstance = jest
  .spyOn(process.stderr, 'write')
  .mockImplementation(() => true);

interface SwaggerInfo {
  [key: string]: unknown;
  version?: string;
}

interface SwaggerDocument {
  [key: string]: unknown;
  info?: SwaggerInfo;
  servers?: Array<{ url: string }>;
}

type PatchModule = {
  CONTRACT_PATH: string;
  OUTPUT_PATH: string;
  ensureEnv: (name: string) => string;
  getApiBaseUrl: () => string;
  getUserServiceVersion: () => string;
  readSwaggerSchema: (path: string) => SwaggerDocument;
  patchSwaggerServerUrl: (doc: SwaggerDocument, url: string) => SwaggerDocument;
  stampUserServiceVersion: (doc: SwaggerDocument, version: string) => SwaggerDocument;
  writeSwaggerSchema: (path: string, doc: SwaggerDocument) => string;
  patchSwaggerSchema: (contractPath?: string, outputPath?: string) => string;
};

const API_BASE_URL: string = 'http://mockoon:8080';
const READ_FAILURE: string = 'ENOENT: no such file or directory';
const PINNED_VERSION: string = 'v2.6.0';

const pristineContract: SwaggerDocument = {
  openapi: '3.1.0',
  info: { title: 'User Service API', version: '1.0.0' },
  servers: [{ url: 'https://api.vilnacrm.com' }],
};

describe('patchSwaggerServer', () => {
  let patchModule: PatchModule;

  beforeAll(async () => {
    patchModule =
      (await import('../../../../scripts/patchSwaggerServer.mjs')) as unknown as PatchModule;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
    process.env.USER_SERVICE_VERSION = PINNED_VERSION;
    mockReadFileSync.mockReturnValue(JSON.stringify(pristineContract));
  });

  afterAll(() => {
    mockExit.mockRestore();
    mockStderr.mockRestore();
  });

  describe('environment access', () => {
    it('returns the value when the variable is set', () => {
      process.env.PATCH_SWAGGER_TEST_VAR = 'set';

      expect(patchModule.ensureEnv('PATCH_SWAGGER_TEST_VAR')).toBe('set');

      delete process.env.PATCH_SWAGGER_TEST_VAR;
    });

    it('exits with a diagnostic when the variable is missing', () => {
      delete process.env.PATCH_SWAGGER_TEST_VAR;

      expect(() => patchModule.ensureEnv('PATCH_SWAGGER_TEST_VAR')).toThrow(
        'process.exit was called'
      );
      expect(mockStderr).toHaveBeenCalledWith(
        '❌ Missing required environment variable: PATCH_SWAGGER_TEST_VAR\n'
      );
    });

    it('reads the api base url and the single user-service pin', () => {
      expect(patchModule.getApiBaseUrl()).toBe(API_BASE_URL);
      expect(patchModule.getUserServiceVersion()).toBe(PINNED_VERSION);
    });
  });

  describe('readSwaggerSchema', () => {
    it('reads and parses the committed contract', () => {
      expect(patchModule.readSwaggerSchema('./contract.json')).toEqual(pristineContract);
      expect(mockReadFileSync).toHaveBeenCalledWith('./contract.json', 'utf8');
    });

    it('exits when the contract cannot be read', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error(READ_FAILURE);
      });

      expect(() => patchModule.readSwaggerSchema('./missing.json')).toThrow(
        'process.exit was called'
      );
      expect(mockStderr).toHaveBeenCalledWith(
        `❌ Failed to read or parse swagger schema at "./missing.json": ${READ_FAILURE}\n`
      );
    });

    it('exits when the contract is not valid JSON', () => {
      mockReadFileSync.mockReturnValue('{ not json');

      expect(() => patchModule.readSwaggerSchema('./broken.json')).toThrow(
        'process.exit was called'
      );
    });
  });

  describe('patchSwaggerServerUrl', () => {
    it('replaces the first server url without mutating the source document', () => {
      const doc: SwaggerDocument = { servers: [{ url: 'https://api.vilnacrm.com' }] };

      expect(patchModule.patchSwaggerServerUrl(doc, API_BASE_URL).servers).toEqual([
        { url: API_BASE_URL },
      ]);
      expect(doc.servers).toEqual([{ url: 'https://api.vilnacrm.com' }]);
    });

    it('preserves the other properties of the first server entry', () => {
      const doc: SwaggerDocument = {
        servers: [{ url: 'https://api.vilnacrm.com', description: 'prod' } as { url: string }],
      };

      expect(patchModule.patchSwaggerServerUrl(doc, API_BASE_URL).servers?.[0]).toEqual({
        url: API_BASE_URL,
        description: 'prod',
      });
    });

    it('creates the servers array when the document has none', () => {
      expect(patchModule.patchSwaggerServerUrl({}, API_BASE_URL).servers).toEqual([
        { url: API_BASE_URL },
      ]);
    });

    it('replaces a servers value that is not an array', () => {
      const doc: SwaggerDocument = { servers: 'wrong' as unknown as Array<{ url: string }> };

      expect(patchModule.patchSwaggerServerUrl(doc, API_BASE_URL).servers).toEqual([
        { url: API_BASE_URL },
      ]);
    });

    it('replaces an empty servers array', () => {
      expect(patchModule.patchSwaggerServerUrl({ servers: [] }, API_BASE_URL).servers).toEqual([
        { url: API_BASE_URL },
      ]);
    });
  });

  describe('stampUserServiceVersion — /swagger surfaces the pinned release (#381 F4)', () => {
    it('renders the pinned user-service release as the document version', () => {
      expect(
        patchModule.stampUserServiceVersion(pristineContract, PINNED_VERSION).info?.version
      ).toBe(PINNED_VERSION);
    });

    it('exposes the release as a machine-readable extension', () => {
      expect(
        patchModule.stampUserServiceVersion(pristineContract, PINNED_VERSION).info?.[
          'x-user-service-version'
        ]
      ).toBe(PINNED_VERSION);
    });

    it('preserves the upstream document version for traceability', () => {
      expect(
        patchModule.stampUserServiceVersion(pristineContract, PINNED_VERSION).info?.[
          'x-upstream-spec-version'
        ]
      ).toBe('1.0.0');
    });

    it('keeps every other info property', () => {
      expect(
        patchModule.stampUserServiceVersion(pristineContract, PINNED_VERSION).info?.title
      ).toBe('User Service API');
    });

    it('does not mutate the source document', () => {
      patchModule.stampUserServiceVersion(pristineContract, PINNED_VERSION);

      expect(pristineContract.info?.version).toBe('1.0.0');
    });

    it('creates info when the document has none and omits the upstream key', () => {
      expect(patchModule.stampUserServiceVersion({}, PINNED_VERSION).info).toEqual({
        version: PINNED_VERSION,
        'x-user-service-version': PINNED_VERSION,
      });
    });
  });

  describe('writeSwaggerSchema', () => {
    it('writes pretty-printed JSON and reports both patched facts', () => {
      const doc: SwaggerDocument = {
        info: { version: PINNED_VERSION },
        servers: [{ url: API_BASE_URL }],
      };

      expect(patchModule.writeSwaggerSchema('./out.json', doc)).toBe(
        `✅ Swagger spec patched: server ${API_BASE_URL}, user-service ${PINNED_VERSION}`
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith('./out.json', JSON.stringify(doc, null, 2));
    });

    it('does not throw when the document has no servers', () => {
      expect(patchModule.writeSwaggerSchema('./out.json', {})).toContain('server undefined');
    });
  });

  describe('patchSwaggerSchema — the whole shipped path', () => {
    it('emits a document pointing at the configured API and stamped with the pin', () => {
      patchModule.patchSwaggerSchema('./contract.json', './out.json');

      const [target, contents] = mockWriteFileSync.mock.calls[0] as [string, string];
      const written: SwaggerDocument = JSON.parse(contents);

      expect(target).toBe('./out.json');
      expect(written.servers?.[0]?.url).toBe(API_BASE_URL);
      expect(written.info?.version).toBe(PINNED_VERSION);
      expect(written.info?.['x-user-service-version']).toBe(PINNED_VERSION);
    });

    it('defaults to the committed contract and the served output path', () => {
      expect(patchModule.CONTRACT_PATH).toBe('./contracts/user-service/openapi.json');
      expect(patchModule.OUTPUT_PATH).toBe('./public/swagger-schema.json');

      patchModule.patchSwaggerSchema();

      expect(mockReadFileSync).toHaveBeenCalledWith(patchModule.CONTRACT_PATH, 'utf8');
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        patchModule.OUTPUT_PATH,
        expect.stringContaining('x-user-service-version')
      );
    });

    it('exits when the pin is missing rather than shipping an unversioned spec', () => {
      delete process.env.USER_SERVICE_VERSION;

      expect(() => patchModule.patchSwaggerSchema('./contract.json', './out.json')).toThrow(
        'process.exit was called'
      );

      process.env.USER_SERVICE_VERSION = PINNED_VERSION;
    });
  });
});
