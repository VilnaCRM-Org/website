/**
 * Integration coverage for the `useSwagger` hook.
 *
 * Drives the real `useEffect` lifecycle against a stubbed `fetch` to exercise
 * every branch: success, non-ok response, JSON-parse failure, generic network
 * error, the `AbortError` early-return (both still-mounted and on unmount), the
 * `schemaUrl` refetch, and the abort-on-unmount cleanup.
 */
import { act, renderHook, waitFor } from '@testing-library/react';

import useSwagger from '../../../../src/features/swagger/hooks/useSwagger';

type Schema = { openapi: string };

const schema: Schema = { openapi: '3.0.0' };
const SERVER_ERROR_MESSAGE = 'Failed to fetch swagger schema – 500 Server Error';

describe('integration: useSwagger', () => {
  let fetchSpy: jest.SpyInstance;
  let abortSpy: jest.SpyInstance;

  beforeEach(() => {
    abortSpy = jest.spyOn(AbortController.prototype, 'abort');
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    abortSpy?.mockRestore();
  });

  it('starts with empty state', () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useSwagger());

    expect(result.current.swaggerContent).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('loads the schema from the default url on mount', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(schema), { status: 200 }));

    const { result } = renderHook(() => useSwagger());

    await waitFor(() => expect(result.current.swaggerContent).toEqual(schema));
    expect(result.current.error).toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith('/swagger-schema.json', {
      signal: expect.anything(),
    });
  });

  it('refetches when the schema url changes', async () => {
    const second: Schema = { openapi: '3.1.0' };
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(schema), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(second), { status: 200 }));

    const { result, rerender } = renderHook(({ url }: { url: string }) => useSwagger(url), {
      initialProps: { url: '/a.json' },
    });

    await waitFor(() => expect(result.current.swaggerContent).toEqual(schema));

    rerender({ url: '/b.json' });

    await waitFor(() => expect(result.current.swaggerContent).toEqual(second));
    expect(fetchSpy).toHaveBeenNthCalledWith(1, '/a.json', { signal: expect.anything() });
    expect(fetchSpy).toHaveBeenNthCalledWith(2, '/b.json', { signal: expect.anything() });
  });

  it('sets an error when the response is not ok', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('x', { status: 500, statusText: 'Server Error' }));

    const { result } = renderHook(() => useSwagger());

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.error?.message).toBe(SERVER_ERROR_MESSAGE);
    expect(result.current.swaggerContent).toBeNull();
  });

  it('sets an error when JSON parsing fails', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('not-json', { status: 200 }));

    const { result } = renderHook(() => useSwagger());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.swaggerContent).toBeNull();
  });

  it('sets an error on a generic network failure', async () => {
    const networkError = new Error('network error');
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(networkError);

    const { result } = renderHook(() => useSwagger());

    await waitFor(() => expect(result.current.error).toBe(networkError));
    expect(result.current.swaggerContent).toBeNull();
  });

  it('ignores an AbortError while still mounted', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    let reject!: (reason?: unknown) => void;
    fetchSpy = jest.spyOn(global, 'fetch').mockReturnValue(
      new Promise((_resolve, rej) => {
        reject = rej;
      })
    );

    const { result } = renderHook(() => useSwagger());

    await act(async () => {
      reject(abortError);
      await Promise.resolve();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.swaggerContent).toBeNull();
  });

  it('ignores an AbortError raised after unmount', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(abortError);

    const { result, unmount } = renderHook(() => useSwagger());

    await act(async () => {
      unmount();
      await Promise.resolve();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.swaggerContent).toBeNull();
  });

  it('aborts the in-flight request on unmount', () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));

    const { unmount } = renderHook(() => useSwagger());
    unmount();

    expect(abortSpy).toHaveBeenCalled();
  });
});
