import { writeFile } from 'node:fs/promises';

const mockFetch: jest.Mock = jest.fn();
global.fetch = mockFetch;

const mockWriteFile: jest.MockedFunction<typeof writeFile> = jest.fn();

jest.mock('dotenv/config', () => ({}), { virtual: true });
jest.mock('node:fs/promises', () => ({
  writeFile: mockWriteFile,
}));

type GraphqlModule = {
  buildSchemaUrl: () => string;
  fetchGraphqlSchema: (url: string) => Promise<string>;
  refreshGraphqlSchema: (url: string, filePath: string) => Promise<boolean>;
  saveGraphqlSchema: (sdl: string, filePath: string) => Promise<void>;
};

describe('graphql schema fetcher', () => {
  const version: string = 'v2.6.0';
  const expectedUrl: string = `https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${version}/.github/graphql-spec/spec`;
  const sdl: string = 'type Query { healthCheck(id: ID!): HealthCheck }';
  const outputPath: string = './contracts/user-service/schema.graphql';

  let buildSchemaUrl: () => string;
  let fetchGraphqlSchema: (url: string) => Promise<string>;
  let refreshGraphqlSchema: (url: string, filePath: string) => Promise<boolean>;
  let saveGraphqlSchema: (sdl: string, filePath: string) => Promise<void>;

  beforeAll(async () => {
    process.env.USER_SERVICE_VERSION = version;

    const graphqlModule: GraphqlModule = await import('../../../../scripts/fetchGraphqlSchema.mjs');
    buildSchemaUrl = graphqlModule.buildSchemaUrl;
    fetchGraphqlSchema = graphqlModule.fetchGraphqlSchema;
    refreshGraphqlSchema = graphqlModule.refreshGraphqlSchema;
    saveGraphqlSchema = graphqlModule.saveGraphqlSchema;
  });

  beforeEach(() => {
    mockFetch.mockClear();
    mockWriteFile.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sdl),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.USER_SERVICE_VERSION = undefined;
  });

  test('buildSchemaUrl derives the URL from the single upstream pin', () => {
    expect(buildSchemaUrl()).toBe(expectedUrl);
  });

  test('fetchGraphqlSchema returns the SDL when the response is ok', async () => {
    await expect(fetchGraphqlSchema(expectedUrl)).resolves.toBe(sdl);
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
  });

  test('fetchGraphqlSchema throws when the response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(fetchGraphqlSchema(expectedUrl)).rejects.toThrow(
      'Failed to fetch GraphQL schema. HTTP status: 404 Not Found'
    );
  });

  test('fetchGraphqlSchema throws if url is missing or not a string', async () => {
    // @ts-expect-error testing runtime type check
    await expect(fetchGraphqlSchema(undefined)).rejects.toThrow(
      'URL parameter is required and must be a string'
    );
    // @ts-expect-error testing runtime type check
    await expect(fetchGraphqlSchema(123)).rejects.toThrow(
      'URL parameter is required and must be a string'
    );
  });

  test('saveGraphqlSchema writes the SDL verbatim', async () => {
    await saveGraphqlSchema(sdl, outputPath);
    expect(mockWriteFile).toHaveBeenCalledWith(outputPath, sdl);
  });

  test('saveGraphqlSchema throws if sdl is missing or not a string', async () => {
    // @ts-expect-error testing runtime type check
    await expect(saveGraphqlSchema(undefined, outputPath)).rejects.toThrow(
      'sdl parameter is required and must be a string'
    );
    // @ts-expect-error testing runtime type check
    await expect(saveGraphqlSchema(123, outputPath)).rejects.toThrow(
      'sdl parameter is required and must be a string'
    );
  });

  test('saveGraphqlSchema throws if filePath is missing or not a string', async () => {
    // @ts-expect-error testing runtime type check
    await expect(saveGraphqlSchema(sdl, undefined)).rejects.toThrow(
      'filePath parameter is required and must be a string'
    );
    // @ts-expect-error testing runtime type check
    await expect(saveGraphqlSchema(sdl, 123)).rejects.toThrow(
      'filePath parameter is required and must be a string'
    );
  });

  test('refreshGraphqlSchema fetches then writes', async () => {
    await expect(refreshGraphqlSchema(expectedUrl, outputPath)).resolves.toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
    expect(mockWriteFile).toHaveBeenCalledWith(outputPath, sdl);
  });

  test('refreshGraphqlSchema rethrows fetch failures without writing', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(refreshGraphqlSchema(expectedUrl, outputPath)).rejects.toThrow('fetch failed');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
