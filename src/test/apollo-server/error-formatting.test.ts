import type { GraphQLFormattedError } from 'graphql';

import { createFormatError } from '../../../docker/apollo-server/error-formatting';
import { QUERY_GUARDS, QUERY_GUARD_EXTENSION } from '../../../docker/apollo-server/query-guards';
import { resetUsers } from '../../../docker/apollo-server/resolvers';

import { CREATE_USER_MUTATION, MockServer, graphqlRequest, startMockServer } from './mock-server';

/**
 * Issue #381 / F2 — `formatError` must never return anything derived from an
 * internal error. The removed defect appended the raw `error.message` in a
 * `details` field for both INTERNAL_SERVER_ERROR and BAD_REQUEST (CWE-209).
 *
 * Scenario classes: positive (a known code yields its generic message plus a
 * correlation id), negative (internal text is absent from the response and present
 * only in the server log), boundary (no extensions at all, an unknown code, a
 * non-Error thrown value).
 *
 * Locale / responsive / a11y — Not applicable: no UI is rendered by this layer.
 */

const INTERNAL_TEXT = 'ECONNREFUSED 10.0.0.7:5432 while querying table users';

function formattedError(
  extensions: Record<string, unknown>,
  message = 'raw internal message'
): GraphQLFormattedError {
  return { message, extensions } as GraphQLFormattedError;
}

describe('formatError — client-facing error shaping', () => {
  const logger = { error: jest.fn() };
  const formatError = createFormatError(logger);

  beforeEach(() => {
    logger.error.mockClear();
  });

  describe('generic messages replace anything internal', () => {
    it.each([
      ['INTERNAL_SERVER_ERROR', 'Something went wrong on the server. Please try again later.'],
      ['BAD_REQUEST', 'The request was invalid. Please check your input.'],
      ['BAD_USER_INPUT', 'The request was invalid. Please check your input.'],
      ['GRAPHQL_VALIDATION_FAILED', "Your query doesn't match the schema. Please check it!"],
      ['GRAPHQL_PARSE_FAILED', 'The request could not be parsed.'],
    ])('maps %s to its generic message', (code, expected) => {
      const result = formatError(formattedError({ code }), new Error(INTERNAL_TEXT));

      expect(result.message).toBe(expected);
    });

    it('falls back to a neutral message for an unrecognised code', () => {
      const result = formatError(formattedError({ code: 'SOMETHING_NEW' }), new Error('boom'));

      expect(result.message).toBe('The request could not be completed.');
      expect(result.extensions?.code).toBe('SOMETHING_NEW');
    });

    it('treats a missing code as an internal server error', () => {
      const result = formatError(formattedError({}), new Error('boom'));

      expect(result.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
      expect(result.message).toBe('Something went wrong on the server. Please try again later.');
    });
  });

  describe('internal detail never leaves the process', () => {
    it.each(['INTERNAL_SERVER_ERROR', 'BAD_REQUEST'])('drops the details field for %s', code => {
      const result = formatError(
        { ...formattedError({ code }), details: INTERNAL_TEXT } as GraphQLFormattedError,
        new Error(INTERNAL_TEXT)
      );

      expect(result).not.toHaveProperty('details');
      expect(JSON.stringify(result)).not.toContain(INTERNAL_TEXT);
    });

    it.each(['stacktrace', 'exception', 'details'])('strips the %s extension', key => {
      const result = formatError(
        formattedError({ code: 'INTERNAL_SERVER_ERROR', [key]: INTERNAL_TEXT }),
        new Error(INTERNAL_TEXT)
      );

      expect(result.extensions).not.toHaveProperty(key);
    });

    it('allow-lists extensions, so a key nobody anticipated cannot ride out', () => {
      // A deny-list would only remove the leaks known today; anything a future error
      // class, resolver mistake or dependency bump introduces would pass straight
      // through — the same CWE-209 failure this module exists to close.
      const result = formatError(
        formattedError({
          code: 'INTERNAL_SERVER_ERROR',
          somethingNobodyAnticipated: INTERNAL_TEXT,
          serviceUrl: 'postgres://user:hunter2@10.0.0.7:5432/users',
        }),
        new Error(INTERNAL_TEXT)
      );

      expect(Object.keys(result.extensions ?? {})).toEqual(['code', 'correlationId']);
    });

    it('keeps the enumerated reason a resolver authored', () => {
      const result = formatError(
        formattedError({ code: 'BAD_REQUEST', reason: 'INVALID_EMAIL' }),
        new Error(INTERNAL_TEXT)
      );

      expect(result.extensions?.reason).toBe('INVALID_EMAIL');
    });
  });

  describe('correlation id', () => {
    it('attaches a unique correlation id to every formatted error', () => {
      const first = formatError(formattedError({ code: 'BAD_REQUEST' }), new Error('a'));
      const second = formatError(formattedError({ code: 'BAD_REQUEST' }), new Error('b'));

      expect(first.extensions?.correlationId).toEqual(expect.any(String));
      expect(first.extensions?.correlationId).not.toBe(second.extensions?.correlationId);
    });

    it('logs the internal detail server-side against that id', () => {
      const result = formatError(
        formattedError({ code: 'INTERNAL_SERVER_ERROR' }),
        new Error(INTERNAL_TEXT)
      );

      expect(logger.error).toHaveBeenCalledTimes(1);
      const [message, meta] = logger.error.mock.calls[0] as [string, Record<string, unknown>];
      expect(message).toContain(String(result.extensions?.correlationId));
      expect(String(meta.detail)).toContain(INTERNAL_TEXT);
    });

    it('logs a non-Error thrown value without crashing', () => {
      expect(() =>
        formatError(formattedError({ code: 'BAD_REQUEST' }), 'plain string')
      ).not.toThrow();

      const [, meta] = logger.error.mock.calls[0] as [string, Record<string, unknown>];
      expect(meta.detail).toBe('plain string');
    });
  });

  describe('query-guard rejections report why, from a message authored here', () => {
    it.each([
      [QUERY_GUARDS.DEPTH, 'The query is nested too deeply.'],
      [QUERY_GUARDS.COST, 'The query is too expensive to execute.'],
      [QUERY_GUARDS.PAGE_SIZE, 'The requested page size is too large.'],
    ])('maps the %s guard to its own message', (guard, expected) => {
      const result = formatError(
        formattedError(
          { code: 'GRAPHQL_VALIDATION_FAILED', [QUERY_GUARD_EXTENSION]: guard },
          'Query is too deep: it nests deeper than the maximum of 8 levels.'
        ),
        new Error('internal')
      );

      expect(result.message).toBe(expected);
    });

    it('does not let an unrecognised guard value forward a raw message', () => {
      // Forwarding whenever a `queryGuard` key was present would have made the
      // sanitisation opt-out-able by any error that happened to carry one.
      const result = formatError(
        formattedError(
          { code: 'INTERNAL_SERVER_ERROR', [QUERY_GUARD_EXTENSION]: 'NOT_A_REAL_GUARD' },
          INTERNAL_TEXT
        ),
        new Error(INTERNAL_TEXT)
      );

      expect(result.message).toBe('Something went wrong on the server. Please try again later.');
      expect(JSON.stringify(result)).not.toContain(INTERNAL_TEXT);
    });

    it('still records the rule’s detailed message server-side', () => {
      const detailed = 'Query is too deep: it nests deeper than the maximum of 8 levels.';
      formatError(
        formattedError(
          { code: 'GRAPHQL_VALIDATION_FAILED', [QUERY_GUARD_EXTENSION]: QUERY_GUARDS.DEPTH },
          detailed
        ),
        new Error(detailed)
      );

      const [, meta] = logger.error.mock.calls[0] as [string, Record<string, unknown>];
      expect(String(meta.detail)).toContain(detailed);
    });
  });
});

describe('formatError — over HTTP, against the real mock', () => {
  let server: MockServer;

  afterEach(async () => {
    await server.stop();
    resetUsers();
  });

  it('returns a generic body with no internals when a resolver throws', async () => {
    server = await startMockServer({
      resolverOverrides: {
        Mutation: {
          createUser: (): never => {
            throw new Error(INTERNAL_TEXT);
          },
        },
      },
    });

    const { body, raw } = await graphqlRequest(server.url, CREATE_USER_MUTATION, {
      input: {
        email: 'boom@example.com',
        initials: 'BO',
        password: 'Strong-Password-123',
        clientMutationId: 'boom-1',
      },
    });

    expect(raw).not.toContain(INTERNAL_TEXT);
    expect(raw).not.toContain('"details"');
    expect(raw).not.toContain('"stacktrace"');
    expect(body.errors?.[0]?.message).toBe(
      'Something went wrong on the server. Please try again later.'
    );
    expect(body.errors?.[0]?.extensions).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      correlationId: expect.any(String),
    });
    expect(server.errorLog).toHaveBeenCalled();
  });

  it('returns a generic body with no internals for a validation failure', async () => {
    server = await startMockServer();

    const { status, raw, body } = await graphqlRequest(
      server.url,
      'mutation { createUser(input: { email: "a@b.co" }) { user { id } } }'
    );

    expect(status).toBe(400);
    expect(raw).not.toContain('"details"');
    expect(raw).not.toContain('"stacktrace"');
    expect(body.errors?.[0]?.message).toBe("Your query doesn't match the schema. Please check it!");
  });
});
