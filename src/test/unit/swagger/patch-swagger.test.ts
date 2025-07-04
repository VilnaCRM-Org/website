import fs from 'node:fs';

import logger from '../../../../scripts/logger';

const MOCKOON_URL: string = 'http://mockoon:8080';
const SCHEMA_FILE_PATH: string = './public/swagger-schema.json';

jest.mock('../../../../scripts/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('dotenv/config', () => ({}), { virtual: true });
jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));
jest.mock('dotenv', () => ({
  config: jest.fn(),
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

interface SwaggerDocument {
  [key: string]: unknown;
  servers?: Array<{ url: string }>;
}

function ensureEnv(name: string): string {
  const value: string | undefined = process.env[name];
  if (!value) {
    logger.error(`❌ Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function getMockUrl(): string {
  const isDev: boolean = process.env.NODE_ENV === 'development';
  return ensureEnv(
    isDev ? 'NEXT_PUBLIC_MOCKOON_LOCAL_API_URL' : 'NEXT_PUBLIC_MOCKOON_CONTAINER_API_URL'
  );
}

function readSwaggerSchema(path: string): SwaggerDocument {
  try {
    const content: string = fs.readFileSync(path, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    const message: string = error instanceof Error ? error.message : 'Unknown error';

    logger.error(`❌ Failed to read or parse swagger schema at "${path}":`, message);
    process.exit(1);
    throw new Error('Unreachable');
  }
}

function patchSwaggerServerUrl(doc: SwaggerDocument, url: string): SwaggerDocument {
  const patchedDoc: SwaggerDocument = { ...doc };

  if (Array.isArray(patchedDoc.servers) && patchedDoc.servers.length > 0) {
    patchedDoc.servers = [...patchedDoc.servers];
    patchedDoc.servers[0] = { ...patchedDoc.servers[0], url };
  } else {
    patchedDoc.servers = [{ url }];
  }

  return patchedDoc;
}

function writeSwaggerSchema(path: string, doc: SwaggerDocument): string {
  fs.writeFileSync(path, JSON.stringify(doc, null, 2));
  return `✅ Swagger server URL patched to: ${doc.servers?.[0]?.url}`;
}
const mockLoggerError: jest.MockedFunction<typeof logger.error> = jest.mocked(logger.error);
describe('patch swagger utils', () => {
  const mockSwaggerDoc: SwaggerDocument = {
    swagger: '2.0',
    info: { title: 'Test API', version: '1.0.0' },
    servers: [{ url: 'https://old-url.com' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFileSync.mockReturnValue(JSON.stringify(mockSwaggerDoc));
  });

  afterAll(() => {
    mockExit.mockRestore();
    mockLoggerError.mockRestore();
  });

  describe('ensureEnv', () => {
    test('returns environment variable value when it exists', () => {
      process.env.TEST_VAR = 'test-value';
      const result: string = ensureEnv('TEST_VAR');
      expect(result).toBe('test-value');
      process.env.TEST_VAR = '';
    });

    test('throws error and exits when environment variable is missing', () => {
      process.env.MISSING_VAR = '';
      expect(() => ensureEnv('MISSING_VAR')).toThrow('process.exit was called');
      expect(mockLoggerError).toHaveBeenCalledWith(
        '❌ Missing required environment variable: MISSING_VAR'
      );
    });
  });

  describe('getMockUrl', () => {
    test('returns local URL when NODE_ENV is development', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true,
      });
      process.env.NEXT_PUBLIC_MOCKOON_LOCAL_API_URL = MOCKOON_URL;
      const result: string = getMockUrl();
      expect(result).toBe(MOCKOON_URL);
      process.env.NEXT_PUBLIC_MOCKOON_LOCAL_API_URL = '';
    });

    test('returns container URL when NODE_ENV is not development', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true,
      });
      process.env.NEXT_PUBLIC_MOCKOON_CONTAINER_API_URL = MOCKOON_URL;
      const result: string = getMockUrl();
      expect(result).toBe(MOCKOON_URL);

      process.env.NEXT_PUBLIC_MOCKOON_CONTAINER_API_URL = '';
    });
  });

  describe('readSwaggerSchema', () => {
    test('reads and parses JSON file successfully', () => {
      const path: string = './test.json';
      const result: SwaggerDocument = readSwaggerSchema(path);
      expect(mockReadFileSync).toHaveBeenCalledWith(path, 'utf8');
      expect(result).toEqual(mockSwaggerDoc);
    });

    test('throws error and exits when file is not found', () => {
      const path: string = './missing.json';
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => readSwaggerSchema(path)).toThrow('process.exit was called');
      expect(mockLoggerError).toHaveBeenCalledWith(
        '❌ Failed to read or parse swagger schema at "./missing.json":',
        'ENOENT: no such file or directory'
      );
    });
  });

  describe('patchSwaggerServerUrl', () => {
    test('modifies existing server url', () => {
      const doc: SwaggerDocument = { swagger: '2.0', servers: [{ url: 'old' }] };
      const updated: SwaggerDocument = patchSwaggerServerUrl(doc, 'new');
      expect(updated.servers).toEqual([{ url: 'new' }]);
    });

    test('creates servers array if missing', () => {
      const doc: SwaggerDocument = { swagger: '2.0' };
      const updated: SwaggerDocument = patchSwaggerServerUrl(doc, 'new');
      expect(updated.servers).toEqual([{ url: 'new' }]);
    });

    test('overwrites if servers is invalid', () => {
      const doc: SwaggerDocument = {
        swagger: '2.0',
        servers: 'wrong' as unknown as Array<{ url: string }>,
      };
      const updated: SwaggerDocument = patchSwaggerServerUrl(doc, 'new');
      expect(updated.servers).toEqual([{ url: 'new' }]);
    });
  });

  describe('writeSwaggerSchema', () => {
    test('writes file and returns success string', () => {
      const path: string = './swagger.json';
      const doc: SwaggerDocument = { swagger: '2.0', servers: [{ url: 'new-url' }] };
      const result: string = writeSwaggerSchema(path, doc);

      expect(result).toBe('✅ Swagger server URL patched to: new-url');
      expect(mockWriteFileSync).toHaveBeenCalledWith(path, JSON.stringify(doc, null, 2));
    });

    test('works even if no servers defined', () => {
      const path: string = './swagger.json';
      const doc: SwaggerDocument = { swagger: '2.0' };
      const result: string = writeSwaggerSchema(path, doc);

      expect(result).toBe('✅ Swagger server URL patched to: undefined');
      expect(mockWriteFileSync).toHaveBeenCalledWith(path, JSON.stringify(doc, null, 2));
    });
  });

  describe('integration test', () => {
    test('end-to-end logic with dev env', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true,
      });
      process.env.NEXT_PUBLIC_MOCKOON_LOCAL_API_URL = MOCKOON_URL;

      const result: string = writeSwaggerSchema(
        SCHEMA_FILE_PATH,
        patchSwaggerServerUrl(readSwaggerSchema(SCHEMA_FILE_PATH), getMockUrl())
      );

      expect(result).toBe(`✅ Swagger server URL patched to: ${MOCKOON_URL}`);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });
});
