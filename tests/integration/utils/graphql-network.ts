/**
 * GraphQL network test double for the integration layer.
 *
 * Integration tests run the *real* Apollo Client (`HttpLink` + `InMemoryCache`)
 * and stub only the external resource it talks to — the network — by replacing
 * the global `fetch`. This is the website equivalent of CRM's
 * `tests/integration/mocks/server.ts`: a single, shared place that owns the
 * HTTP boundary so individual tests describe *behaviour*, not transport plumbing.
 *
 * It deliberately returns real `Response` objects so the link's response
 * parsing, status handling and error classification execute for real.
 */

export type FetchMock = jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>;

export interface CapturedGraphQLRequest {
  url: string;
  method: string;
  headers: Headers;
  body: {
    operationName?: string;
    query: string;
    variables: Record<string, unknown>;
  };
}

const JSON_HEADERS: Record<string, string> = { 'content-type': 'application/json' };

const realFetch: typeof fetch | undefined = globalThis.fetch;

/** Install a `jest.fn()` in place of the global `fetch`. Pair with `restoreFetch`. */
export function installFetchMock(): FetchMock {
  const mock = jest.fn() as FetchMock;
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

/** Restore the environment's original `fetch`. */
export function restoreFetch(): void {
  globalThis.fetch = realFetch as typeof fetch;
}

/** A GraphQL transport-level success (`{ data }`, HTTP 200). */
export function graphqlData<T>(data: T): Response {
  return new Response(JSON.stringify({ data }), { status: 200, headers: JSON_HEADERS });
}

/** A GraphQL-level failure (`{ errors }` with HTTP 200), e.g. validation errors. */
export function graphqlErrors(errors: readonly unknown[]): Response {
  return new Response(JSON.stringify({ errors }), { status: 200, headers: JSON_HEADERS });
}

/** A transport/HTTP-level failure such as a 5xx returned by the gateway. */
export function httpError(status: number, body: unknown = { error: 'request failed' }): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function resolveRequestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url;
}

/** Decode a captured `fetch` call into the GraphQL request the client sent. */
export function readGraphQLRequest(mock: FetchMock, callIndex = 0): CapturedGraphQLRequest {
  const call = mock.mock.calls[callIndex];
  if (!call) {
    throw new Error(`Expected fetch to have been called at index ${callIndex}, but it was not.`);
  }

  const [input, init = {}] = call;
  const rawBody = typeof init.body === 'string' ? init.body : '';

  return {
    url: resolveRequestUrl(input),
    method: init.method ?? 'GET',
    headers: new Headers(init.headers),
    body: rawBody ? JSON.parse(rawBody) : { query: '', variables: {} },
  };
}
