import { writeFile } from 'node:fs/promises';

const mockFetch: jest.Mock = jest.fn();
global.fetch = mockFetch;

const mockWriteFile: jest.MockedFunction<typeof writeFile> = jest.fn();
const mockExistsSync: jest.Mock = jest.fn();

jest.mock('dotenv/config', () => ({}), { virtual: true });
jest.mock('node:fs', () => ({
  existsSync: mockExistsSync,
}));
jest.mock('node:fs/promises', () => ({
  writeFile: mockWriteFile,
}));

jest.mock('js-yaml', () => ({
  load: jest.fn(() => ({ swagger: '2.0' })),
}));

interface JsYamlMock {
  load: jest.Mock;
}

const mockExit: jest.SpyInstance = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit was called');
});
type SwaggerModule = {
  buildSpecUrl: () => string;
  fetchSwaggerYaml: (url: string) => Promise<string>;
  normalizeSpec: (node: unknown) => unknown;
  refreshSwaggerSchema: (url: string, filePath: string) => Promise<boolean>;
  saveSwaggerJson: (yamlText: string, filePath: string) => Promise<void>;
};

describe('swagger utils', () => {
  const version: string = 'v2.6.0';
  const expectedUrl: string = `https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${version}/.github/openapi-spec/spec.yaml`;

  let buildSpecUrl: () => string;
  let fetchSwaggerYaml: (url: string) => Promise<string>;
  let normalizeSpec: (node: unknown) => unknown;
  let refreshSwaggerSchema: (url: string, filePath: string) => Promise<boolean>;
  let saveSwaggerJson: (yamlText: string, filePath: string) => Promise<void>;

  beforeAll(async () => {
    process.env.USER_SERVICE_VERSION = version;

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('swagger: "2.0"'),
    });

    const swaggerModule: SwaggerModule = await import('../../../../scripts/fetchSwaggerSchema.mjs');
    buildSpecUrl = swaggerModule.buildSpecUrl;
    fetchSwaggerYaml = swaggerModule.fetchSwaggerYaml;
    normalizeSpec = swaggerModule.normalizeSpec;
    refreshSwaggerSchema = swaggerModule.refreshSwaggerSchema;
    saveSwaggerJson = swaggerModule.saveSwaggerJson;
  });

  beforeEach(() => {
    mockFetch.mockClear();
    mockWriteFile.mockClear();
    mockExistsSync.mockClear();
    mockExistsSync.mockReturnValue(false);

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('swagger: "2.0"'),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.USER_SERVICE_VERSION;
    mockExit.mockRestore();
  });

  test('buildSpecUrl returns correct URL', () => {
    const url: string = buildSpecUrl();
    expect(url).toBe(expectedUrl);
  });

  test('fetchSwaggerYaml returns text when response is ok', async () => {
    const mockText: string = 'swagger: "2.0"';
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockText),
    });

    const result: string = await fetchSwaggerYaml(expectedUrl);
    expect(result).toBe(mockText);
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
  });

  test('fetchSwaggerYaml throws if response not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(fetchSwaggerYaml(expectedUrl)).rejects.toThrow(
      'Failed to fetch swagger schema. HTTP status: 404 Not Found'
    );
  });

  test('saveSwaggerJson writes parsed YAML to JSON file', async () => {
    const yamlText: string = 'swagger: "2.0"';
    const outputPath: string = './public/swagger-schema.json';

    await saveSwaggerJson(yamlText, outputPath);

    const jsYaml: JsYamlMock = jest.requireMock('js-yaml');
    expect(jsYaml.load).toHaveBeenCalledWith(yamlText);
    expect(mockWriteFile).toHaveBeenCalledWith(
      outputPath,
      `${JSON.stringify({ swagger: '2.0' }, null, 2)}\n`
    );
  });

  test('refreshSwaggerSchema rethrows fetch failures even when a local schema exists', async () => {
    mockExistsSync.mockReturnValue(true);
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(refreshSwaggerSchema(expectedUrl, './public/swagger-schema.json')).rejects.toThrow(
      'fetch failed'
    );

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  test('refreshSwaggerSchema rethrows fetch failures when no local schema exists', async () => {
    mockExistsSync.mockReturnValue(false);
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(refreshSwaggerSchema(expectedUrl, './public/swagger-schema.json')).rejects.toThrow(
      'fetch failed'
    );
  });

  test('fetchSwaggerYaml throws if url is missing or invalid', async () => {
    // @ts-expect-error testing runtime type check
    await expect(fetchSwaggerYaml(undefined)).rejects.toThrow(
      'URL parameter is required and must be a string'
    );
    // @ts-expect-error testing runtime type check
    await expect(fetchSwaggerYaml(123)).rejects.toThrow(
      'URL parameter is required and must be a string'
    );
  });

  test('saveSwaggerJson throws if yamlText is missing or not a string', async () => {
    // @ts-expect-error testing runtime type check
    await expect(saveSwaggerJson(undefined, './swagger.json')).rejects.toThrow(
      'yamlText parameter is required and must be a string'
    );
    // @ts-expect-error testing runtime type check
    await expect(saveSwaggerJson(123, './swagger.json')).rejects.toThrow(
      'yamlText parameter is required and must be a string'
    );
  });

  test('normalizeSpec drops null-valued keys at every depth', () => {
    expect(
      normalizeSpec({
        type: 'string',
        maxLength: null,
        format: null,
        nested: { keep: 1, drop: null },
      })
    ).toEqual({ type: 'string', nested: { keep: 1 } });
  });

  test('normalizeSpec recurses through arrays', () => {
    expect(normalizeSpec([{ keep: 'a', drop: null }, { keep: 'b' }])).toEqual([
      { keep: 'a' },
      { keep: 'b' },
    ]);
  });

  test('normalizeSpec preserves falsy values that are not null', () => {
    expect(normalizeSpec({ zero: 0, empty: '', no: false, gone: null })).toEqual({
      zero: 0,
      empty: '',
      no: false,
    });
  });

  test('normalizeSpec returns primitives unchanged', () => {
    expect(normalizeSpec('text')).toBe('text');
    expect(normalizeSpec(42)).toBe(42);
    expect(normalizeSpec(null)).toBeNull();
  });

  test('saveSwaggerJson throws if filePath is missing or not a string', async () => {
    // @ts-expect-error testing runtime type check
    await expect(saveSwaggerJson('yamlText', undefined)).rejects.toThrow(
      'filePath parameter is required and must be a string'
    );
    // @ts-expect-error testing runtime type check
    await expect(saveSwaggerJson('yamlText', 123)).rejects.toThrow(
      'filePath parameter is required and must be a string'
    );
  });
});
