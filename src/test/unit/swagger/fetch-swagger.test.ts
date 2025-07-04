import { writeFile } from 'node:fs/promises';

const mockFetch: jest.Mock = jest.fn();
global.fetch = mockFetch;

const mockWriteFile: jest.MockedFunction<typeof writeFile> = jest.fn();

jest.mock('dotenv/config', () => ({}), { virtual: true });
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
  saveSwaggerJson: (yamlText: string, filePath: string) => Promise<void>;
};

describe('swagger utils', () => {
  const version: string = 'v2.6.0';
  const expectedUrl: string = `https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${version}/.github/openapi-spec/spec.yaml`;

  let buildSpecUrl: () => string;
  let fetchSwaggerYaml: (url: string) => Promise<string>;
  let saveSwaggerJson: (yamlText: string, filePath: string) => Promise<void>;

  beforeAll(async () => {
    process.env.USER_SERVICE_SPEC_VERSION = version;

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('swagger: "2.0"'),
    });

    const swaggerModule: SwaggerModule = await import('../../../../scripts/fetchSwaggerSchema.mjs');
    buildSpecUrl = swaggerModule.buildSpecUrl;
    fetchSwaggerYaml = swaggerModule.fetchSwaggerYaml;
    saveSwaggerJson = swaggerModule.saveSwaggerJson;
  });

  beforeEach(() => {
    mockFetch.mockClear();
    mockWriteFile.mockClear();

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('swagger: "2.0"'),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.USER_SERVICE_SPEC_VERSION = undefined;
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
      JSON.stringify({ swagger: '2.0' }, null, 2)
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
