import * as apolloClient from '@apollo/client';
import { GraphQLFormattedError } from 'graphql';

import {
  CLIENT_ERROR_KEYS,
  ClientErrorMessages,
  getClientErrorMessages,
} from '@/shared/clientErrorMessages';
import HTTPStatusCodes from '@/shared/httpStatusCodes';

import {
  handleApolloError,
  HandleApolloErrorProps,
  handleNetworkError,
  isServerError,
  NETWORK_ERROR_PATTERNS,
  ServerErrorShape,
} from '../../../../src/features/landing/helpers/handleApolloError';

interface MockCombinedGraphQLErrors {
  readonly errors: GraphQLFormattedError[];
  readonly brand: 'CombinedGraphQLErrors';
}

function createMockCombinedGraphQLErrors(
  errors: GraphQLFormattedError[]
): MockCombinedGraphQLErrors {
  return { errors, brand: 'CombinedGraphQLErrors' };
}

type StatusCode = Pick<ServerErrorShape, 'statusCode'>;

describe('integration: handleApolloError helpers', () => {
  it('freezes the exported network error patterns', () => {
    expect(Object.isFrozen(NETWORK_ERROR_PATTERNS)).toBe(true);
    expect(NETWORK_ERROR_PATTERNS).toContain('failed to fetch');
  });

  describe('isServerError', () => {
    it('rejects non-object values', () => {
      expect(isServerError(null)).toBe(false);
      expect(isServerError('boom')).toBe(false);
      expect(isServerError(42)).toBe(false);
    });

    it('rejects an empty object (no statusCode and no message)', () => {
      expect(isServerError({})).toBe(false);
    });

    it('rejects when statusCode has the wrong type', () => {
      expect(isServerError({ statusCode: 'bad' })).toBe(false);
    });

    it('rejects when message has the wrong type', () => {
      expect(isServerError({ message: 123 })).toBe(false);
    });

    it('accepts an object with only a numeric statusCode', () => {
      expect(isServerError({ statusCode: 500 })).toBe(true);
    });

    it('accepts an object with only a string message', () => {
      expect(isServerError({ message: 'down' })).toBe(true);
    });

    it('accepts an object with both fields present', () => {
      expect(isServerError({ statusCode: 404, message: 'missing' })).toBe(true);
    });
  });

  describe('handleNetworkError', () => {
    let messages: ClientErrorMessages;

    beforeEach(() => {
      messages = getClientErrorMessages();
    });

    it('returns the network message for a "Failed to fetch" message', () => {
      const error: ServerErrorShape = { statusCode: 400, message: 'Failed to fetch' };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.NETWORK]);
    });

    it('returns the network message for "network request failed"', () => {
      const error: ServerErrorShape = {
        statusCode: 400,
        message: 'Network request failed',
      };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.NETWORK]);
    });

    it('returns the network message for "fetch failed"', () => {
      const error: ServerErrorShape = { statusCode: 400, message: 'Fetch failed' };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.NETWORK]);
    });

    it('returns the unauthorized message for a 401 status', () => {
      const error: StatusCode = { statusCode: HTTPStatusCodes.UNAUTHORIZED };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.UNAUTHORIZED]);
    });

    it('returns the forbidden message for a 403 status', () => {
      const error: StatusCode = { statusCode: HTTPStatusCodes.FORBIDDEN };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.DENIED]);
    });

    it('returns the server-error message for a 500 status', () => {
      const error: StatusCode = { statusCode: HTTPStatusCodes.INTERNAL_SERVER_ERROR };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.SERVER_ERROR]);
    });

    it('returns the server-error message for a 599 status (upper boundary)', () => {
      const error: StatusCode = { statusCode: 599 };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.SERVER_ERROR]);
    });

    it('returns the went-wrong message for an unknown status', () => {
      const error: StatusCode = { statusCode: 999 };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
    });

    it('returns the went-wrong message for a non-server-error input', () => {
      expect(handleNetworkError(null)).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
    });

    it('returns the went-wrong message for a non-network message without status', () => {
      const error: ServerErrorShape = { message: 'Some error' };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
    });
  });

  describe('handleApolloError', () => {
    let messages: ClientErrorMessages;
    let combinedGraphQLErrorsSpy: jest.SpyInstance;

    beforeEach(() => {
      messages = getClientErrorMessages();
      combinedGraphQLErrorsSpy = jest
        .spyOn(apolloClient.CombinedGraphQLErrors, 'is')
        .mockImplementation(
          (err: unknown): err is apolloClient.CombinedGraphQLErrors =>
            err !== null &&
            typeof err === 'object' &&
            'brand' in err &&
            (err as MockCombinedGraphQLErrors).brand === 'CombinedGraphQLErrors'
        );
    });

    afterEach(() => {
      combinedGraphQLErrorsSpy.mockRestore();
    });

    it('returns the unexpected message for null input', () => {
      expect(handleApolloError({ error: null })).toBe(
        messages[CLIENT_ERROR_KEYS.UNEXPECTED]
      );
    });

    it('returns the unexpected message for a non-object input', () => {
      expect(handleApolloError({ error: 'oops' })).toBe(
        messages[CLIENT_ERROR_KEYS.UNEXPECTED]
      );
    });

    it('maps a GraphQL error with a server statusCode', () => {
      const graphQLError: GraphQLFormattedError = {
        message: 'Server Error',
        extensions: { statusCode: HTTPStatusCodes.INTERNAL_SERVER_ERROR },
      };
      const props: HandleApolloErrorProps = {
        error: createMockCombinedGraphQLErrors([graphQLError]),
      };
      expect(handleApolloError(props)).toBe(messages[CLIENT_ERROR_KEYS.SERVER_ERROR]);
    });

    it('maps a GraphQL error with a FORBIDDEN statusCode', () => {
      const graphQLError: GraphQLFormattedError = {
        message: 'Forbidden Access',
        extensions: { statusCode: HTTPStatusCodes.FORBIDDEN },
      };
      const props: HandleApolloErrorProps = {
        error: createMockCombinedGraphQLErrors([graphQLError]),
      };
      expect(handleApolloError(props)).toBe(messages[CLIENT_ERROR_KEYS.DENIED]);
    });

    it('maps a GraphQL error whose message mentions UNAUTHORIZED', () => {
      const graphQLError: GraphQLFormattedError = { message: 'UNAUTHORIZED' };
      const props: HandleApolloErrorProps = {
        error: createMockCombinedGraphQLErrors([graphQLError]),
      };
      expect(handleApolloError(props)).toBe(messages[CLIENT_ERROR_KEYS.UNAUTHORIZED]);
    });

    it('joins multiple GraphQL error messages', () => {
      const graphQLErrors: GraphQLFormattedError[] = [
        { message: 'Error 1' },
        { message: 'Error 2' },
      ];
      const props: HandleApolloErrorProps = {
        error: createMockCombinedGraphQLErrors(graphQLErrors),
      };
      expect(handleApolloError(props)).toBe('Error 1, Error 2');
    });

    it('falls through to later handlers when the GraphQL error list is empty', () => {
      const props: HandleApolloErrorProps = {
        error: createMockCombinedGraphQLErrors([]),
      };
      expect(handleApolloError(props)).toBe(messages[CLIENT_ERROR_KEYS.UNEXPECTED]);
    });

    it('falls through when GraphQL errors yield only empty messages', () => {
      const graphQLErrors: GraphQLFormattedError[] = [{ message: '' }];
      const props: HandleApolloErrorProps = {
        error: createMockCombinedGraphQLErrors(graphQLErrors),
      };
      expect(handleApolloError(props)).toBe(messages[CLIENT_ERROR_KEYS.UNEXPECTED]);
    });

    it('handles a direct server error carrying a statusCode', () => {
      const error: ServerErrorShape = {
        statusCode: HTTPStatusCodes.UNAUTHORIZED,
        message: 'Network Error',
      };
      expect(handleApolloError({ error })).toBe(messages[CLIENT_ERROR_KEYS.UNAUTHORIZED]);
    });

    it('detects a network pattern in the message of a non-server-shaped object', () => {
      // statusCode of the wrong type makes isServerError return false, so the
      // network-pattern fallback (the final branch) is what maps the message.
      const error: { statusCode: string; message: string } = {
        statusCode: 'not-a-number',
        message: 'Failed to fetch',
      };
      expect(handleApolloError({ error })).toBe(messages[CLIENT_ERROR_KEYS.NETWORK]);
    });

    it('returns the unexpected message for an object with no server shape or pattern', () => {
      const error: { foo: string } = { foo: 'bar' };
      expect(handleApolloError({ error })).toBe(messages[CLIENT_ERROR_KEYS.UNEXPECTED]);
    });

    it('returns the unexpected message when the error message is undefined', () => {
      const error: Record<string, never> = {};
      expect(handleApolloError({ error })).toBe(messages[CLIENT_ERROR_KEYS.UNEXPECTED]);
    });
  });
});
