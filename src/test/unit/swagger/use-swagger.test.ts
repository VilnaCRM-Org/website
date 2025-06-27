import { renderHook, waitFor } from '@testing-library/react';

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
    mockFetch.mockClear();
    mockAbort.mockClear();
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

    unmount();

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.swaggerContent).toBeNull();
  });

  test('aborts fetch when component unmounts', () => {
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

  test('handles different error types', async () => {
    const testCases: Array<{ error: unknown; expectedMessage: string }> = [
      { error: new TypeError('Type error'), expectedMessage: 'Type error' },
      { error: new ReferenceError('Reference error'), expectedMessage: 'Reference error' },
      { error: new Error('String error'), expectedMessage: 'String error' },
      { error: new Error('500'), expectedMessage: '500' },
    ];

    for (const { error, expectedMessage } of testCases) {
      mockFetch.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useSwagger());

      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(Error);
      });

      expect(result.current.error?.message).toBe(expectedMessage);
      expect(result.current.swaggerContent).toBeNull();
    }
  });
});
