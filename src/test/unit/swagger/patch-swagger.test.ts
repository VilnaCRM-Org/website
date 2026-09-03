import fs from 'node:fs';

/**
 * Covers the REAL `scripts/patchSwaggerServer.mjs` — the script the Docker build
 * runs to produce `public/swagger-schema.json`, the document `/swagger` renders.
 *
 * This suite previously re-declared copies of the script's functions inside the
 * spec and asserted against those copies, so it could not fail when the script
 * changed — which is how both the `servers[]` handling (#376 F2) and the version
 * stamping (#381 F4) drifted underneath it. It now imports the real module.
 *
 * Scenario classes: positive (the server list is rebuilt from the build-controlled
 * origin, the pinned release is stamped), negative (missing env var, unreadable or
 * malformed contract, an injected `servers` entry at the root and at every nested
 * override OpenAPI allows), boundary (no `servers`, a non-array `servers`, an empty
 * `servers`, missing `info`, `x-` named map entries).
 *
 * Locale / responsive / a11y — Not applicable: a build-time transform of a JSON
 * document; the rendered page is covered by the swagger e2e and visual suites.
 */

const API_BASE_URL: string = 'http://mockoon:8080';
const CONTRACT_PATH: string = './contracts/user-service/openapi.json';
const OUTPUT_PATH: string = './public/swagger-schema.json';
const READ_FAILURE: string = 'ENOENT: no such file or directory';
const PINNED_VERSION: string = 'v2.6.0';

jest.mock('dotenv/config', () => ({}), { virtual: true });
jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));
jest.mock('dotenv', () => ({
  config: jest.fn(() => ({ parsed: {} })),
}));
jest.mock('dotenv-expand', () => ({
  expand: jest.fn(),
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
  servers?: Array<{ url: string; [key: string]: unknown }>;
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

describe('patchSwaggerServer script', () => {
  const contract: SwaggerDocument = {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    servers: [{ url: 'https://api.vilnacrm.com', description: '' }],
  };

  let ensureEnv: PatchModule['ensureEnv'];
  let getApiBaseUrl: PatchModule['getApiBaseUrl'];
  let getUserServiceVersion: PatchModule['getUserServiceVersion'];
  let readSwaggerSchema: PatchModule['readSwaggerSchema'];
  let patchSwaggerServerUrl: PatchModule['patchSwaggerServerUrl'];
  let stampUserServiceVersion: PatchModule['stampUserServiceVersion'];
  let writeSwaggerSchema: PatchModule['writeSwaggerSchema'];
  let patchSwaggerSchema: PatchModule['patchSwaggerSchema'];

  beforeAll(async () => {
    const patchModule: PatchModule =
      (await import('../../../../scripts/patchSwaggerServer.mjs')) as unknown as PatchModule;

    ensureEnv = patchModule.ensureEnv;
    getApiBaseUrl = patchModule.getApiBaseUrl;
    getUserServiceVersion = patchModule.getUserServiceVersion;
    readSwaggerSchema = patchModule.readSwaggerSchema;
    patchSwaggerServerUrl = patchModule.patchSwaggerServerUrl;
    stampUserServiceVersion = patchModule.stampUserServiceVersion;
    writeSwaggerSchema = patchModule.writeSwaggerSchema;
    patchSwaggerSchema = patchModule.patchSwaggerSchema;

    expect(patchModule.CONTRACT_PATH).toBe(CONTRACT_PATH);
    expect(patchModule.OUTPUT_PATH).toBe(OUTPUT_PATH);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFileSync.mockReturnValue(JSON.stringify(contract));
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
    process.env.USER_SERVICE_VERSION = PINNED_VERSION;
  });

  afterAll(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.USER_SERVICE_VERSION;
    mockExit.mockRestore();
    mockStderr.mockRestore();
  });

  describe('ensureEnv', () => {
    it('returns the value when the variable is set', () => {
      process.env.PATCH_SWAGGER_TEST_VAR = 'set';
      try {
        expect(ensureEnv('PATCH_SWAGGER_TEST_VAR')).toBe('set');
      } finally {
        delete process.env.PATCH_SWAGGER_TEST_VAR;
      }
    });

    it('exits with a diagnostic when the variable is missing', () => {
      delete process.env.PATCH_SWAGGER_TEST_VAR;

      expect(() => ensureEnv('PATCH_SWAGGER_TEST_VAR')).toThrow('process.exit was called');
      expect(mockStderr).toHaveBeenCalledWith(
        '❌ Missing required environment variable: PATCH_SWAGGER_TEST_VAR\n'
      );
    });

    it('exits when the variable is set to an empty string', () => {
      process.env.PATCH_SWAGGER_TEST_VAR = '';

      expect(() => ensureEnv('PATCH_SWAGGER_TEST_VAR')).toThrow('process.exit was called');
      delete process.env.PATCH_SWAGGER_TEST_VAR;
    });
  });

  describe('environment access', () => {
    it('reads the api base url and the single user-service pin', () => {
      expect(getApiBaseUrl()).toBe(API_BASE_URL);
      expect(getUserServiceVersion()).toBe(PINNED_VERSION);
    });

    it('exits when NEXT_PUBLIC_API_BASE_URL is unset', () => {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;

      expect(() => getApiBaseUrl()).toThrow('process.exit was called');
      expect(mockStderr).toHaveBeenCalledWith(
        '❌ Missing required environment variable: NEXT_PUBLIC_API_BASE_URL\n'
      );
    });
  });

  describe('readSwaggerSchema', () => {
    it('reads and parses the committed contract', () => {
      expect(readSwaggerSchema(CONTRACT_PATH)).toEqual(contract);
      expect(mockReadFileSync).toHaveBeenCalledWith(CONTRACT_PATH, 'utf8');
    });

    it('exits when the contract cannot be read', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error(READ_FAILURE);
      });

      expect(() => readSwaggerSchema('./missing.json')).toThrow('process.exit was called');
      expect(mockStderr).toHaveBeenCalledWith(
        `❌ Failed to read or parse swagger schema at "./missing.json": ${READ_FAILURE}\n`
      );
    });

    it('exits when the contract is not valid JSON', () => {
      mockReadFileSync.mockReturnValue('{ not json');

      expect(() => readSwaggerSchema(CONTRACT_PATH)).toThrow('process.exit was called');
      expect(mockStderr).toHaveBeenCalled();
    });
  });

  describe('patchSwaggerServerUrl', () => {
    it('replaces the single declared server with the build-controlled url', () => {
      expect(patchSwaggerServerUrl(contract, API_BASE_URL).servers).toEqual([
        { url: API_BASE_URL },
      ]);
    });

    // The finding this whole change exists for (#376 F2): an upstream compromise
    // that appends a server entry must not leave it selectable in the swagger
    // "Try it out" console, where a user's token would be POSTed to it.
    it('strips injected servers[1..] instead of only overwriting servers[0]', () => {
      const injected: SwaggerDocument = {
        ...contract,
        servers: [
          { url: 'https://api.vilnacrm.com' },
          { url: 'https://attacker.example', description: 'Production (EU)' },
          { url: 'https://attacker.example/v2' },
        ],
      };

      const patched: SwaggerDocument = patchSwaggerServerUrl(injected, API_BASE_URL);

      expect(patched.servers).toEqual([{ url: API_BASE_URL }]);
      expect(JSON.stringify(patched)).not.toContain('attacker.example');
    });

    // OpenAPI allows a `servers` override on a Path Item and on an Operation, and
    // swagger-ui offers those in the same "Try it out" dropdown. Rebuilding only
    // the root would leave that sink open, and the ingestion guard cannot close it
    // either — an injected `https://attacker.example` is a well-formed https URL.
    it('strips servers overrides declared on a path item or an operation', () => {
      const injected: SwaggerDocument = {
        openapi: '3.0.0',
        servers: [{ url: 'https://api.vilnacrm.com' }],
        paths: {
          '/t': {
            servers: [{ url: 'https://attacker.example/path' }],
            get: { servers: [{ url: 'https://attacker.example/op' }], responses: {} },
          },
        },
      } as unknown as SwaggerDocument;

      const patched: SwaggerDocument = patchSwaggerServerUrl(injected, API_BASE_URL);

      expect(patched.servers).toEqual([{ url: API_BASE_URL }]);
      expect(JSON.stringify(patched)).not.toContain('attacker.example');
      expect(JSON.stringify(patched)).not.toContain('"servers":[{"url":"https');
    });

    it('keeps everything else in a path item that carried a servers override', () => {
      const doc: SwaggerDocument = {
        paths: { '/t': { servers: [{ url: 'https://x' }], get: { responses: { 200: {} } } } },
      } as unknown as SwaggerDocument;

      const patched: SwaggerDocument = patchSwaggerServerUrl(doc, API_BASE_URL);

      expect(JSON.parse(JSON.stringify(patched)).paths['/t'].get).toEqual({
        responses: { 200: {} },
      });
    });

    // The strip walks the containers that actually hold Path Items. A blanket
    // recursive filter also deleted a schema property and an example payload field
    // that merely happened to be called `servers`, silently changing the document.
    it('leaves a schema property or example payload named servers untouched', () => {
      const doc: SwaggerDocument = {
        components: { schemas: { Config: { properties: { servers: { type: 'array' } } } } },
        paths: {
          '/c': {
            get: {
              responses: {
                200: { content: { 'application/json': { example: { servers: ['a', 'b'] } } } },
              },
            },
          },
        },
      } as unknown as SwaggerDocument;

      const patched: string = JSON.stringify(patchSwaggerServerUrl(doc, API_BASE_URL));

      expect(JSON.parse(patched).components.schemas.Config.properties.servers).toBeDefined();
      expect(
        JSON.parse(patched).paths['/c'].get.responses[200].content['application/json'].example
      ).toEqual({ servers: ['a', 'b'] });
    });

    // A Callback Object maps a runtime expression to a full Path Item, which can
    // carry its own servers and its own operations with theirs.
    it('strips servers inside an operation callback and components.callbacks', () => {
      const doc: SwaggerDocument = {
        paths: {
          '/u': {
            post: {
              callbacks: {
                onEvent: {
                  '{$request.body#/cb}': {
                    servers: [{ url: 'https://attacker.example/cb-path' }],
                    post: { servers: [{ url: 'https://attacker.example/cb-op' }] },
                  },
                },
              },
            },
          },
        },
        components: {
          callbacks: {
            Named: { '{$req}': { post: { servers: [{ url: 'https://attacker.example/c' }] } } },
          },
        },
      } as unknown as SwaggerDocument;

      const patched: SwaggerDocument = patchSwaggerServerUrl(doc, API_BASE_URL);

      expect(JSON.stringify(patched)).not.toContain('attacker.example');
      expect(
        Object.keys(JSON.parse(JSON.stringify(patched)).paths['/u'].post.callbacks.onEvent)
      ).toEqual(['{$request.body#/cb}']);
    });

    // A specification extension is arbitrary user data, never a Path Item, so an
    // `x-` entry holding its own `servers` field must survive the walk.
    it('preserves x- specification extensions that carry a servers field', () => {
      const doc: SwaggerDocument = {
        paths: {
          'x-vendor': { servers: ['keep-me'] },
          '/u': { post: { callbacks: { cb: { 'x-ext': { servers: ['keep-me-too'] } } } } },
        },
        components: { callbacks: { 'x-c': { servers: ['keep-three'] } } },
      } as unknown as SwaggerDocument;

      const patched = JSON.parse(JSON.stringify(patchSwaggerServerUrl(doc, API_BASE_URL)));

      expect(patched.paths['x-vendor']).toEqual({ servers: ['keep-me'] });
      expect(patched.paths['/u'].post.callbacks.cb['x-ext']).toEqual({ servers: ['keep-me-too'] });
      expect(patched.components.callbacks['x-c']).toEqual({ servers: ['keep-three'] });
    });

    // `x-` means "specification extension" only inside an Object that declares
    // extension support. A component name matches ^[a-zA-Z0-9._-]+$, so `x-foo`
    // is a legal name for a reusable Path Item — skipping it would leave a
    // $ref-able override intact.
    it.each([
      [
        'components.pathItems',
        {
          components: {
            pathItems: { 'x-foo': { get: { servers: [{ url: 'https://attacker.example' }] } } },
          },
        },
      ],
      [
        'components.callbacks',
        {
          components: {
            callbacks: {
              'x-bar': { '{$r}': { post: { servers: [{ url: 'https://attacker.example' }] } } },
            },
          },
        },
      ],
      [
        'webhooks',
        { webhooks: { 'x-baz': { post: { servers: [{ url: 'https://attacker.example' }] } } } },
      ],
      [
        'an operation callbacks map',
        {
          paths: {
            '/u': {
              post: {
                callbacks: {
                  'x-ext': { '{$r}': { post: { servers: [{ url: 'https://attacker.example' }] } } },
                },
              },
            },
          },
        },
      ],
    ])('still strips a servers override under an x- named entry in %s', (_label, doc) => {
      expect(
        JSON.stringify(patchSwaggerServerUrl(doc as unknown as SwaggerDocument, API_BASE_URL))
      ).not.toContain('attacker.example');
    });

    it('strips a webhook operation servers override', () => {
      const doc: SwaggerDocument = {
        webhooks: { userCreated: { post: { servers: [{ url: 'https://attacker.example' }] } } },
      } as unknown as SwaggerDocument;

      expect(JSON.stringify(patchSwaggerServerUrl(doc, API_BASE_URL))).not.toContain(
        'attacker.example'
      );
    });

    it('does not mutate a document that carries nested servers', () => {
      const doc: SwaggerDocument = {
        paths: { '/t': { get: { servers: [{ url: 'https://attacker.example' }] } } },
      } as unknown as SwaggerDocument;

      patchSwaggerServerUrl(doc, API_BASE_URL);

      expect(JSON.stringify(doc)).toContain('attacker.example');
    });

    // Supersedes the older "preserves the other properties of the first server
    // entry" expectation: #376 F2 rebuilds the array from the one origin the build
    // controls, so upstream-authored metadata on that entry is dropped with it.
    it('drops per-server metadata carried alongside the url', () => {
      const withMetadata: SwaggerDocument = {
        servers: [{ url: 'https://api.vilnacrm.com', description: 'anything', variables: {} }],
      };

      expect(patchSwaggerServerUrl(withMetadata, API_BASE_URL).servers).toEqual([
        { url: API_BASE_URL },
      ]);
    });

    it('creates the servers array when the document has none', () => {
      expect(patchSwaggerServerUrl({ openapi: '3.0.0' }, API_BASE_URL).servers).toEqual([
        { url: API_BASE_URL },
      ]);
    });

    it('replaces a servers value that is not an array', () => {
      const malformed: SwaggerDocument = {
        servers: 'https://api.vilnacrm.com',
      } as unknown as SwaggerDocument;

      expect(patchSwaggerServerUrl(malformed, API_BASE_URL).servers).toEqual([
        { url: API_BASE_URL },
      ]);
    });

    it('replaces an empty servers array', () => {
      expect(patchSwaggerServerUrl({ servers: [] }, API_BASE_URL).servers).toEqual([
        { url: API_BASE_URL },
      ]);
    });

    it('leaves every other part of the document untouched', () => {
      const patched: SwaggerDocument = patchSwaggerServerUrl(contract, API_BASE_URL);

      expect(patched.openapi).toBe('3.0.0');
      expect(patched.info).toEqual(contract.info);
    });

    it('does not mutate the document it was given', () => {
      const original: SwaggerDocument = {
        servers: [{ url: 'https://api.vilnacrm.com' }, { url: 'https://attacker.example' }],
      };

      patchSwaggerServerUrl(original, API_BASE_URL);

      expect(original.servers).toHaveLength(2);
      expect(original.servers?.[1]?.url).toBe('https://attacker.example');
    });
  });

  describe('stampUserServiceVersion — /swagger surfaces the pinned release (#381 F4)', () => {
    it('renders the pinned user-service release as the document version', () => {
      expect(stampUserServiceVersion(contract, PINNED_VERSION).info?.version).toBe(PINNED_VERSION);
    });

    it('exposes the release as a machine-readable extension', () => {
      expect(
        stampUserServiceVersion(contract, PINNED_VERSION).info?.['x-user-service-version']
      ).toBe(PINNED_VERSION);
    });

    it('preserves the upstream document version for traceability', () => {
      expect(
        stampUserServiceVersion(contract, PINNED_VERSION).info?.['x-upstream-spec-version']
      ).toBe('1.0.0');
    });

    it('keeps every other info property', () => {
      expect(stampUserServiceVersion(contract, PINNED_VERSION).info?.title).toBe('Test API');
    });

    it('does not mutate the source document', () => {
      stampUserServiceVersion(contract, PINNED_VERSION);

      expect(contract.info?.version).toBe('1.0.0');
    });

    it('creates info when the document has none and omits the upstream key', () => {
      expect(stampUserServiceVersion({}, PINNED_VERSION).info).toEqual({
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

      expect(writeSwaggerSchema(OUTPUT_PATH, doc)).toBe(
        `✅ Swagger spec patched: server ${API_BASE_URL}, user-service ${PINNED_VERSION}`
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(OUTPUT_PATH, JSON.stringify(doc, null, 2));
    });

    // `servers` is optional on the exported type, so a caller passing a document
    // without one must not get a TypeError *after* the file has been written.
    it.each([
      ['a document with no servers key', { openapi: '3.0.0' }],
      ['an empty servers array', { openapi: '3.0.0', servers: [] }],
    ])('still writes, and does not throw, for %s', (_label, doc) => {
      expect(() => writeSwaggerSchema(OUTPUT_PATH, doc)).not.toThrow();
      expect(mockWriteFileSync).toHaveBeenCalledWith(OUTPUT_PATH, JSON.stringify(doc, null, 2));
      expect(writeSwaggerSchema(OUTPUT_PATH, doc)).toContain('server undefined');
    });
  });

  describe('patchSwaggerSchema — the whole shipped path', () => {
    it('reads the committed contract and writes the patched copy elsewhere', () => {
      const result: string = patchSwaggerSchema();

      expect(result).toBe(
        `✅ Swagger spec patched: server ${API_BASE_URL}, user-service ${PINNED_VERSION}`
      );
      expect(mockReadFileSync).toHaveBeenCalledWith(CONTRACT_PATH, 'utf8');

      const [writtenPath, written] = mockWriteFileSync.mock.calls[0] as [string, string];
      expect(writtenPath).toBe(OUTPUT_PATH);
      expect(JSON.parse(written).servers).toEqual([{ url: API_BASE_URL }]);
    });

    it('emits a document pointing at the configured API and stamped with the pin', () => {
      patchSwaggerSchema('./contract.json', './out.json');

      const [target, contents] = mockWriteFileSync.mock.calls[0] as [string, string];
      const written: SwaggerDocument = JSON.parse(contents);

      expect(target).toBe('./out.json');
      expect(written.servers?.[0]?.url).toBe(API_BASE_URL);
      expect(written.info?.version).toBe(PINNED_VERSION);
      expect(written.info?.['x-user-service-version']).toBe(PINNED_VERSION);
    });

    it('honours explicit source and destination paths', () => {
      patchSwaggerSchema('./in.json', './out.json');

      expect(mockReadFileSync).toHaveBeenCalledWith('./in.json', 'utf8');
      expect(mockWriteFileSync.mock.calls[0]?.[0]).toBe('./out.json');
    });

    it('defaults to the committed contract and the served output path', () => {
      patchSwaggerSchema();

      expect(mockReadFileSync).toHaveBeenCalledWith(CONTRACT_PATH, 'utf8');
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        OUTPUT_PATH,
        expect.stringContaining('x-user-service-version')
      );
    });

    it('never writes the contract it read from', () => {
      patchSwaggerSchema();

      expect(mockWriteFileSync).not.toHaveBeenCalledWith(CONTRACT_PATH, expect.anything());
    });

    it('exits when the pin is missing rather than shipping an unversioned spec', () => {
      delete process.env.USER_SERVICE_VERSION;

      expect(() => patchSwaggerSchema('./contract.json', './out.json')).toThrow(
        'process.exit was called'
      );
    });
  });
});
