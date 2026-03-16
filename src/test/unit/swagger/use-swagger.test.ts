import { act, renderHook, waitFor } from '@testing-library/react';

import useSwagger from '../../../features/swagger/hooks/useSwagger';

const mockFetch: jest.Mock = jest.fn();
global.fetch = mockFetch;

const mockAbort: jest.Mock = jest.fn();
const mockAbortController: jest.Mock = jest.fn(() => ({
  signal: 'mock-signal',
  abort: mockAbort,
}));
global.AbortController = mockAbortController;

class MockDOMException extends Error {
  public override name: string;

  constructor(message: string, name: string) {
    super(message);
    this.name = name;
  }
}
global.DOMException = MockDOMException as unknown as typeof DOMException;

interface SwaggerSchema {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, unknown>;
}

type DeferredPromise<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
};

function createDeferredPromise<T>(): DeferredPromise<T> {
  let resolve!: DeferredPromise<T>['resolve'];
  let reject!: DeferredPromise<T>['reject'];
  const promise: Promise<T> = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
}

const mockSwaggerSchema: SwaggerSchema = {
  openapi: '3.0.0',
  info: {
    title: 'Test API',
    version: '1.0.0',
  },
  paths: {
    '/test': {
      get: {
        summary: 'Test endpoint',
      },
    },
  },
};

describe('useSwagger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockAbort.mockReset();
  });

  test('loads swagger schema successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async (): Promise<SwaggerSchema> => mockSwaggerSchema,
    });

    const { result } = renderHook(() => useSwagger());

    await waitFor(() => {
      expect(result.current.swaggerContent).toEqual(mockSwaggerSchema);
    });

    expect(mockFetch).toHaveBeenCalledWith('/swagger-schema.json', {
      signal: 'mock-signal',
    });
    expect(result.current.error).toBeNull();
  });

  test('refetches swagger schema when the schema URL changes', async () => {
    const updatedSwaggerSchema: SwaggerSchema = {
      ...mockSwaggerSchema,
      info: {
        ...mockSwaggerSchema.info,
        version: '2.0.0',
      },
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async (): Promise<SwaggerSchema> => mockSwaggerSchema,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async (): Promise<SwaggerSchema> => updatedSwaggerSchema,
      });

    const { result, rerender } = renderHook(
      ({ schemaUrl }: { schemaUrl: string }) => useSwagger(schemaUrl),
      {
        initialProps: {
          schemaUrl: '/swagger-schema.json',
        },
      }
    );

    await waitFor(() => {
      expect(result.current.swaggerContent).toEqual(mockSwaggerSchema);
    });

    rerender({ schemaUrl: '/swagger-schema-v2.json' });

    await waitFor(() => {
      expect(result.current.swaggerContent).toEqual(updatedSwaggerSchema);
    });

    expect(mockFetch).toHaveBeenNthCalledWith(1, '/swagger-schema.json', {
      signal: 'mock-signal',
    });
    expect(mockFetch).toHaveBeenNthCalledWith(2, '/swagger-schema-v2.json', {
      signal: 'mock-signal',
    });
  });

  test('handles fetch error when response is not ok', async () => {
    const errorMessage: string = 'Failed to fetch swagger schema – 404 Not Found';
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const { result } = renderHook(() => useSwagger());

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });

    expect(result.current.error?.message).toBe(errorMessage);
    expect(result.current.swaggerContent).toBeNull();
  });

  test('handles network error', async () => {
    const networkError: Error = new Error('Network error');
    mockFetch.mockRejectedValueOnce(networkError);

    const { result } = renderHook(() => useSwagger());

    await waitFor(() => {
      expect(result.current.error).toBe(networkError);
    });

    expect(result.current.swaggerContent).toBeNull();
  });

  test('ignores AbortError when component unmounts', async () => {
    const abortError: DOMException = new MockDOMException('Aborted', 'AbortError') as DOMException;
    mockFetch.mockRejectedValueOnce(abortError);

    const { result, unmount } = renderHook(() => useSwagger());

    await act(async () => {
      unmount();
      await Promise.resolve();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.swaggerContent).toBeNull();
  });

  test('ignores AbortError while the hook is still mounted', async () => {
    const abortError: DOMException = new MockDOMException('Aborted', 'AbortError') as DOMException;
    const deferredFetch: DeferredPromise<never> = createDeferredPromise<never>();
    mockFetch.mockReturnValueOnce(deferredFetch.promise);

    const { result } = renderHook(() => useSwagger());

    await act(async () => {
      deferredFetch.reject(abortError);
      await deferredFetch.promise.catch(() => undefined);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.swaggerContent).toBeNull();
  });

  test('aborts fetch when component unmounts', () => {
    mockFetch.mockImplementationOnce(
      () =>
        new Promise(() => {
          // Keep the request pending so unmount only exercises abort behavior.
        })
    );

    const { unmount } = renderHook(() => useSwagger());

    unmount();

    expect(mockAbort).toHaveBeenCalled();
  });

  test('handles JSON parsing error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async (): Promise<never> => {
        throw new Error('Invalid JSON');
      },
    });

    const { result } = renderHook(() => useSwagger());

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });

    expect(result.current.error?.message).toBe('Invalid JSON');
    expect(result.current.swaggerContent).toBeNull();
  });

  test('initial state is correct', () => {
    const { result } = renderHook(() => useSwagger());

    expect(result.current.swaggerContent).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test('handles empty response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async (): Promise<null> => null,
    });

    const { result } = renderHook(() => useSwagger());

    await waitFor(() => {
      expect(result.current.swaggerContent).toBeNull();
    });

    expect(result.current.error).toBeNull();
  });

  test('handles large swagger schema', async () => {
    const largeSchema: SwaggerSchema = {
      openapi: '3.0.0',
      info: {
        title: 'Large API',
        version: '1.0.0',
      },
      paths: {
        '/endpoint1': { get: { summary: 'Endpoint 1' } },
        '/endpoint2': { post: { summary: 'Endpoint 2' } },
        '/endpoint3': { put: { summary: 'Endpoint 3' } },
        '/endpoint4': { delete: { summary: 'Endpoint 4' } },
        '/endpoint5': { patch: { summary: 'Endpoint 5' } },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async (): Promise<SwaggerSchema> => largeSchema,
    });

    const { result } = renderHook(() => useSwagger());

    await waitFor(() => {
      expect(result.current.swaggerContent).toEqual(largeSchema);
    });

    expect(result.current.error).toBeNull();
  });

  test.each([
    { error: new TypeError('Type error'), expectedMessage: 'Type error' },
    { error: new ReferenceError('Reference error'), expectedMessage: 'Reference error' },
    { error: new Error('String error'), expectedMessage: 'String error' },
    { error: new Error('500'), expectedMessage: '500' },
  ])('handles different error types: $expectedMessage', async ({ error, expectedMessage }) => {
    mockFetch.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useSwagger());

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });

    expect(result.current.error?.message).toBe(expectedMessage);
    expect(result.current.swaggerContent).toBeNull();
  });
});
