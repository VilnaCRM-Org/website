import fs from 'node:fs';

const API_BASE_URL: string = 'http://mockoon:8080';
const CONTRACT_PATH: string = './contracts/user-service/openapi.json';
const OUTPUT_PATH: string = './public/swagger-schema.json';

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
const mockConsoleError: jest.SpyInstance = jest
  .spyOn(console, 'error')
  .mockImplementation(() => {});

interface SwaggerDocument {
  [key: string]: unknown;
  servers?: Array<{ url: string; [key: string]: unknown }>;
}

type PatchModule = {
  CONTRACT_PATH: string;
  OUTPUT_PATH: string;
  ensureEnv: (name: string) => string;
  getApiBaseUrl: () => string;
  readSwaggerSchema: (path: string) => SwaggerDocument;
  patchSwaggerServerUrl: (doc: SwaggerDocument, url: string) => SwaggerDocument;
  writeSwaggerSchema: (path: string, doc: SwaggerDocument) => string;
  patchSwaggerServer: (contractPath?: string, outputPath?: string) => string;
};

// The spec imports the script the Docker build actually runs. An earlier version
// re-declared copies of these functions inside the spec, so it kept passing while
// the real `servers[]` handling drifted underneath it.
describe('patchSwaggerServer script', () => {
  const contract: SwaggerDocument = {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    servers: [{ url: 'https://api.vilnacrm.com', description: '' }],
  };

  let ensureEnv: PatchModule['ensureEnv'];
  let getApiBaseUrl: PatchModule['getApiBaseUrl'];
  let readSwaggerSchema: PatchModule['readSwaggerSchema'];
  let patchSwaggerServerUrl: PatchModule['patchSwaggerServerUrl'];
  let writeSwaggerSchema: PatchModule['writeSwaggerSchema'];
  let patchSwaggerServer: PatchModule['patchSwaggerServer'];

  beforeAll(async () => {
    const patchModule: PatchModule = await import('../../../../scripts/patchSwaggerServer.mjs');
    ensureEnv = patchModule.ensureEnv;
    getApiBaseUrl = patchModule.getApiBaseUrl;
    readSwaggerSchema = patchModule.readSwaggerSchema;
    patchSwaggerServerUrl = patchModule.patchSwaggerServerUrl;
    writeSwaggerSchema = patchModule.writeSwaggerSchema;
    patchSwaggerServer = patchModule.patchSwaggerServer;

    expect(patchModule.CONTRACT_PATH).toBe(CONTRACT_PATH);
    expect(patchModule.OUTPUT_PATH).toBe(OUTPUT_PATH);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFileSync.mockReturnValue(JSON.stringify(contract));
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
  });

  afterAll(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('ensureEnv', () => {
    test('returns the value when the variable is set', () => {
      process.env.PATCH_SWAGGER_TEST_VAR = 'set';
      try {
        expect(ensureEnv('PATCH_SWAGGER_TEST_VAR')).toBe('set');
      } finally {
        delete process.env.PATCH_SWAGGER_TEST_VAR;
      }
    });

    test('exits when the variable is missing', () => {
      delete process.env.PATCH_SWAGGER_TEST_VAR;

      expect(() => ensureEnv('PATCH_SWAGGER_TEST_VAR')).toThrow('process.exit was called');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Missing required environment variable: PATCH_SWAGGER_TEST_VAR'
      );
    });

    test('exits when the variable is set to an empty string', () => {
      process.env.PATCH_SWAGGER_TEST_VAR = '';

      expect(() => ensureEnv('PATCH_SWAGGER_TEST_VAR')).toThrow('process.exit was called');
      delete process.env.PATCH_SWAGGER_TEST_VAR;
    });
  });

  describe('getApiBaseUrl', () => {
    test('reads NEXT_PUBLIC_API_BASE_URL', () => {
      expect(getApiBaseUrl()).toBe(API_BASE_URL);
    });

    test('exits when NEXT_PUBLIC_API_BASE_URL is unset', () => {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;

      expect(() => getApiBaseUrl()).toThrow('process.exit was called');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Missing required environment variable: NEXT_PUBLIC_API_BASE_URL'
      );
    });
  });

  describe('readSwaggerSchema', () => {
    test('reads and parses the committed contract', () => {
      expect(readSwaggerSchema(CONTRACT_PATH)).toEqual(contract);
      expect(mockReadFileSync).toHaveBeenCalledWith(CONTRACT_PATH, 'utf8');
    });

    test('exits when the file is missing', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => readSwaggerSchema('./missing.json')).toThrow('process.exit was called');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Failed to read or parse swagger schema at "./missing.json":',
        'ENOENT: no such file or directory'
      );
    });

    test('exits when the file is not valid JSON', () => {
      mockReadFileSync.mockReturnValue('{ not json');

      expect(() => readSwaggerSchema(CONTRACT_PATH)).toThrow('process.exit was called');
      expect(mockConsoleError).toHaveBeenCalled();
    });
  });

  describe('patchSwaggerServerUrl', () => {
    test('replaces the single declared server with the build-controlled url', () => {
      expect(patchSwaggerServerUrl(contract, API_BASE_URL).servers).toEqual([
        { url: API_BASE_URL },
      ]);
    });

    // The finding this whole change exists for (#376 F2): an upstream compromise
    // that appends a server entry must not leave it selectable in the swagger
    // "Try it out" console, where a user's token would be POSTed to it.
    test('strips injected servers[1..] instead of only overwriting servers[0]', () => {
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
    test('strips servers overrides declared on a path item or an operation', () => {
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

    test('keeps everything else in a path item that carried a servers override', () => {
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
    test('leaves a schema property or example payload named servers untouched', () => {
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
    test('strips servers inside an operation callback and components.callbacks', () => {
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
    test('preserves x- specification extensions that carry a servers field', () => {
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
    test.each([
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

    test('strips a webhook operation servers override', () => {
      const doc: SwaggerDocument = {
        webhooks: { userCreated: { post: { servers: [{ url: 'https://attacker.example' }] } } },
      } as unknown as SwaggerDocument;

      expect(JSON.stringify(patchSwaggerServerUrl(doc, API_BASE_URL))).not.toContain(
        'attacker.example'
      );
    });

    test('does not mutate a document that carries nested servers', () => {
      const doc: SwaggerDocument = {
        paths: { '/t': { get: { servers: [{ url: 'https://attacker.example' }] } } },
      } as unknown as SwaggerDocument;

      patchSwaggerServerUrl(doc, API_BASE_URL);

      expect(JSON.stringify(doc)).toContain('attacker.example');
    });

    test('drops per-server metadata carried alongside the url', () => {
      const withMetadata: SwaggerDocument = {
        servers: [{ url: 'https://api.vilnacrm.com', description: 'anything', variables: {} }],
      };

      expect(patchSwaggerServerUrl(withMetadata, API_BASE_URL).servers).toEqual([
        { url: API_BASE_URL },
      ]);
    });

    test('creates the servers array when the document has none', () => {
      expect(patchSwaggerServerUrl({ openapi: '3.0.0' }, API_BASE_URL).servers).toEqual([
        { url: API_BASE_URL },
      ]);
    });

    test('replaces a servers value that is not an array', () => {
      const malformed: SwaggerDocument = {
        servers: 'https://api.vilnacrm.com',
      } as unknown as SwaggerDocument;

      expect(patchSwaggerServerUrl(malformed, API_BASE_URL).servers).toEqual([
        { url: API_BASE_URL },
      ]);
    });

    test('replaces an empty servers array', () => {
      expect(patchSwaggerServerUrl({ servers: [] }, API_BASE_URL).servers).toEqual([
        { url: API_BASE_URL },
      ]);
    });

    test('leaves every other part of the document untouched', () => {
      const patched: SwaggerDocument = patchSwaggerServerUrl(contract, API_BASE_URL);

      expect(patched.openapi).toBe('3.0.0');
      expect(patched.info).toEqual(contract.info);
    });

    test('does not mutate the document it was given', () => {
      const original: SwaggerDocument = {
        servers: [{ url: 'https://api.vilnacrm.com' }, { url: 'https://attacker.example' }],
      };

      patchSwaggerServerUrl(original, API_BASE_URL);

      expect(original.servers).toHaveLength(2);
      expect(original.servers?.[1]?.url).toBe('https://attacker.example');
    });
  });

  describe('writeSwaggerSchema', () => {
    test('writes the patched document and reports the url', () => {
      const doc: SwaggerDocument = { openapi: '3.0.0', servers: [{ url: API_BASE_URL }] };

      expect(writeSwaggerSchema(OUTPUT_PATH, doc)).toBe(
        `✅ Swagger server URL patched to: ${API_BASE_URL}`
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(OUTPUT_PATH, JSON.stringify(doc, null, 2));
    });

    // `servers` is optional on the exported type, so a caller passing a document
    // without one must not get a TypeError *after* the file has been written.
    test.each([
      ['a document with no servers key', { openapi: '3.0.0' }],
      ['an empty servers array', { openapi: '3.0.0', servers: [] }],
    ])('still writes, and does not throw, for %s', (_label, doc) => {
      expect(() => writeSwaggerSchema(OUTPUT_PATH, doc)).not.toThrow();
      expect(mockWriteFileSync).toHaveBeenCalledWith(OUTPUT_PATH, JSON.stringify(doc, null, 2));
      expect(writeSwaggerSchema(OUTPUT_PATH, doc)).toContain('undefined');
    });
  });

  describe('patchSwaggerServer', () => {
    test('reads the committed contract and writes the patched copy elsewhere', () => {
      const result: string = patchSwaggerServer();

      expect(result).toBe(`✅ Swagger server URL patched to: ${API_BASE_URL}`);
      expect(mockReadFileSync).toHaveBeenCalledWith(CONTRACT_PATH, 'utf8');

      const [writtenPath, written] = mockWriteFileSync.mock.calls[0] as [string, string];
      expect(writtenPath).toBe(OUTPUT_PATH);
      expect(JSON.parse(written).servers).toEqual([{ url: API_BASE_URL }]);
    });

    test('honours explicit source and destination paths', () => {
      patchSwaggerServer('./in.json', './out.json');

      expect(mockReadFileSync).toHaveBeenCalledWith('./in.json', 'utf8');
      expect(mockWriteFileSync.mock.calls[0]?.[0]).toBe('./out.json');
    });

    test('never writes the contract it read from', () => {
      patchSwaggerServer();

      expect(mockWriteFileSync).not.toHaveBeenCalledWith(CONTRACT_PATH, expect.anything());
    });
  });
});
