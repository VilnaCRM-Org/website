import type * as NodeFs from 'node:fs';
import * as path from 'node:path';

const mockLogger: { info: jest.Mock; error: jest.Mock } = { info: jest.fn(), error: jest.fn() };
const mockWriteFileSync: jest.Mock = jest.fn();
const mockMkdirSync: jest.Mock = jest.fn();
const mockExistsSync: jest.Mock = jest.fn();

jest.mock('winston', () => ({
  createLogger: (): typeof mockLogger => mockLogger,
  format: { combine: jest.fn(), timestamp: jest.fn(), json: jest.fn() },
  transports: { Console: jest.fn(), File: jest.fn() },
}));

jest.mock('dotenv', () => ({
  __esModule: true,
  default: { config: (): { parsed: Record<string, string> } => ({ parsed: {} }) },
}));

jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
  existsSync: mockExistsSync,
}));

const actualFs: typeof NodeFs = jest.requireActual('node:fs');

const SCHEMA_URL: string = 'https://schema.example.test/graphql-spec/spec';
const OUTPUT_DIR: string = path.resolve(__dirname, '../../../docker/apollo-server');
const OUTPUT_FILE: string = path.join(OUTPUT_DIR, 'schema.graphql');
const PINNED_SDL: string = actualFs.readFileSync(
  path.resolve(__dirname, '../../../contracts/user-service/schema.graphql'),
  'utf-8'
);
const ORIGINAL_ENV: NodeJS.ProcessEnv = process.env;

type FetchInit = { signal: AbortSignal; headers: Record<string, string> };

const okResponse = (body: string): Response => new Response(body, { status: 200 });

const failedResponse = (): Response =>
  new Response('', { status: 503, statusText: 'Service Unavailable' });

const loggedInfo = (): string[] => mockLogger.info.mock.calls.map(([message]) => String(message));

const loggedErrors = (): string[] =>
  mockLogger.error.mock.calls.map(([message]) => String(message));

const loadFetcher = async (env: Record<string, string>): Promise<() => Promise<void>> => {
  process.env = { ...ORIGINAL_ENV, NODE_ENV: 'test', GRAPHQL_SCHEMA_URL: SCHEMA_URL, ...env };
  const fetcher: { fetchAndSaveSchema: () => Promise<void> } =
    await import('../../../docker/apollo-server/schemaFetcher');
  return fetcher.fetchAndSaveSchema;
};

describe('apollo mock schema fetcher', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    mockExistsSync.mockImplementation(actualFs.existsSync);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((): never => undefined as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env = ORIGINAL_ENV;
  });

  test('refuses to load without a configured schema URL', async () => {
    await expect(loadFetcher({ GRAPHQL_SCHEMA_URL: '' })).rejects.toThrow(
      'Schema URL is not configured. Please set the GRAPHQL_SCHEMA_URL environment variable.'
    );
  });

  test('saves a download that matches the pinned digest on the first attempt', async () => {
    fetchSpy.mockResolvedValue(okResponse(PINNED_SDL));
    const fetchAndSaveSchema: () => Promise<void> = await loadFetcher({});

    await fetchAndSaveSchema();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, FetchInit];
    expect(url).toBe(SCHEMA_URL);
    expect(init.headers).toEqual({
      'User-Agent': 'GraphQL/SchemaFetcher',
      Accept: 'application/json',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(mockWriteFileSync).toHaveBeenCalledWith(OUTPUT_FILE, PINNED_SDL, 'utf-8');
    expect(mockMkdirSync).not.toHaveBeenCalled();
    expect(loggedInfo()).toContain(`Fetching OpenAPI schema from: ${SCHEMA_URL}... (Attempt 1/3)`);
    expect(loggedInfo()).toContain(`Schema successfully saved to: ${OUTPUT_FILE}`);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('creates the output directory when it does not exist yet', async () => {
    mockExistsSync.mockImplementation(
      (candidate: string): boolean => candidate !== OUTPUT_DIR && actualFs.existsSync(candidate)
    );
    fetchSpy.mockResolvedValue(okResponse(PINNED_SDL));
    const fetchAndSaveSchema: () => Promise<void> = await loadFetcher({});

    await fetchAndSaveSchema();

    expect(mockMkdirSync).toHaveBeenCalledWith(OUTPUT_DIR, { recursive: true });
    expect(mockWriteFileSync).toHaveBeenCalledWith(OUTPUT_FILE, PINNED_SDL, 'utf-8');
  });

  test('discards a download that does not match the pinned digest without retrying', async () => {
    fetchSpy.mockResolvedValue(okResponse('type Query { tampered: String }\n'));
    const fetchAndSaveSchema: () => Promise<void> = await loadFetcher({});

    await fetchAndSaveSchema();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(loggedErrors()).toContain(
      `Discarded the download; keeping the vendored schema at ${OUTPUT_FILE}`
    );
    expect(loggedInfo()).not.toContain('All retry attempts failed, but continuing execution...');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('retries a failed response with backoff and continues outside production', async () => {
    fetchSpy.mockResolvedValue(failedResponse());
    const fetchAndSaveSchema: () => Promise<void> = await loadFetcher({ NODE_ENV: 'test' });

    const run: Promise<void> = fetchAndSaveSchema();
    await jest.advanceTimersByTimeAsync(2000 + 4000);
    await run;

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(loggedInfo()).toEqual(
      expect.arrayContaining([
        'Retry attempt 1/3 after 2000ms',
        'Retry attempt 2/3 after 4000ms',
        `Fetching OpenAPI schema from: ${SCHEMA_URL}... (Attempt 3/3)`,
        'All retry attempts failed, but continuing execution...',
      ])
    );
    expect(loggedErrors()).toContain(
      'Schema fetch failed: Failed to fetch schema: Service Unavailable'
    );
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('caps the backoff at ten seconds', async () => {
    fetchSpy.mockRejectedValue(new Error('connection reset'));
    const fetchAndSaveSchema: () => Promise<void> = await loadFetcher({
      GRAPHQL_MAX_RETRIES: '5',
    });

    const run: Promise<void> = fetchAndSaveSchema();
    await jest.advanceTimersByTimeAsync(2000 + 4000 + 8000 + 10000);
    await run;

    expect(fetchSpy).toHaveBeenCalledTimes(5);
    expect(loggedInfo()).toEqual(
      expect.arrayContaining(['Retry attempt 3/5 after 8000ms', 'Retry attempt 4/5 after 10000ms'])
    );
    expect(loggedErrors()).toContain('Schema fetch failed: connection reset');
  });

  test('saves the schema once a retry succeeds', async () => {
    fetchSpy
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce(okResponse(PINNED_SDL));
    const fetchAndSaveSchema: () => Promise<void> = await loadFetcher({});

    const run: Promise<void> = fetchAndSaveSchema();
    await jest.advanceTimersByTimeAsync(2000);
    await run;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    expect(loggedInfo()).not.toContain('All retry attempts failed, but continuing execution...');
  });

  test('aborts a request that outlives the configured timeout', async () => {
    fetchSpy.mockImplementation(
      (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        })
    );
    const fetchAndSaveSchema: () => Promise<void> = await loadFetcher({
      GRAPHQL_MAX_RETRIES: '1',
      GRAPHQL_TIMEOUT_MS: '50',
    });

    const run: Promise<void> = fetchAndSaveSchema();
    await jest.advanceTimersByTimeAsync(50);
    await run;

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(loggedErrors()).toContain('Schema fetch timeout after configured time');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  test('exits the process after exhausting retries in production', async () => {
    fetchSpy.mockResolvedValue(failedResponse());
    const fetchAndSaveSchema: () => Promise<void> = await loadFetcher({
      NODE_ENV: 'production',
      GRAPHQL_MAX_RETRIES: '1',
    });

    await fetchAndSaveSchema();

    expect(loggedInfo()).toContain('Exiting process due to repeated errors...');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('makes no attempt and reports nothing when retries are set below one', async () => {
    const fetchAndSaveSchema: () => Promise<void> = await loadFetcher({
      NODE_ENV: 'production',
      GRAPHQL_MAX_RETRIES: '-1',
    });

    await fetchAndSaveSchema();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(loggedInfo()).toEqual([]);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
