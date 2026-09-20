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
  ServerErrorShape,
} from '../../features/landing/helpers/handleApolloError';
import { networkMessage } from '../testing-library/fixtures/errors';

// Mock error type that simulates Apollo Client 4's CombinedGraphQLErrors
interface MockCombinedGraphQLErrors {
  readonly errors: GraphQLFormattedError[];
  readonly brand: 'CombinedGraphQLErrors';
}

// Helper to create a mock that will pass CombinedGraphQLErrors.is() check
function createMockCombinedGraphQLErrors(
  errors: GraphQLFormattedError[]
): MockCombinedGraphQLErrors {
  return {
    errors,
    brand: 'CombinedGraphQLErrors',
  };
}

type StatusCode = Pick<ServerErrorShape, 'statusCode'>;

describe('Error Handling', () => {
  // The type guard is the only thing between an arbitrary thrown value and the
  // destructuring that follows it, so every row is a shape fetch or Apollo can
  // really surface — including the ones with no properties to destructure.
  describe('isServerError', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['a string', networkMessage],
      ['a number', HTTPStatusCodes.INTERNAL_SERVER_ERROR],
      ['an empty object', {}],
    ])('rejects %s without throwing', (_label: string, value: unknown) => {
      expect(isServerError(value)).toBe(false);
    });

    it('accepts an error that carries only a message', () => {
      expect(isServerError({ message: networkMessage })).toBe(true);
    });

    it('accepts an error that carries only a status code', () => {
      expect(isServerError({ statusCode: HTTPStatusCodes.INTERNAL_SERVER_ERROR })).toBe(true);
    });

    it('rejects a status code that is not a number', () => {
      expect(isServerError({ statusCode: '503' })).toBe(false);
    });

    it('rejects a message that is not a string', () => {
      expect(isServerError({ message: 42 })).toBe(false);
    });

    // Both halves must hold: one well-typed property does not vouch for the other.
    it('rejects a numeric status code paired with a non-string message', () => {
      const error: unknown = { statusCode: HTTPStatusCodes.INTERNAL_SERVER_ERROR, message: 42 };
      expect(isServerError(error)).toBe(false);
    });

    it('rejects a string message paired with a non-numeric status code', () => {
      const error: unknown = { statusCode: '503', message: networkMessage };
      expect(isServerError(error)).toBe(false);
    });
  });

  describe('handleNetworkError', () => {
    let messages: ClientErrorMessages;

    beforeEach(() => {
      jest.clearAllMocks();
      messages = getClientErrorMessages();
    });

    it('should return network error for "Failed to fetch" message', () => {
      const error: ServerErrorShape = { statusCode: 400, message: networkMessage };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.NETWORK]);
    });

    it('should return unauthorized error for 401 status', () => {
      const error: StatusCode = { statusCode: HTTPStatusCodes.UNAUTHORIZED };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.UNAUTHORIZED]);
    });

    it('should return forbidden error for 403 status', () => {
      const error: StatusCode = { statusCode: HTTPStatusCodes.FORBIDDEN };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.DENIED]);
    });

    it('should return server error for 500 status', () => {
      const error: StatusCode = { statusCode: HTTPStatusCodes.INTERNAL_SERVER_ERROR };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.SERVER_ERROR]);
    });

    it('should return "went wrong" error for unknown status', () => {
      const error: StatusCode = { statusCode: 999 };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
    });

    it('should return unexpected error for non-object input', () => {
      expect(handleNetworkError(null)).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
    });

    it('returns "went wrong" for an undefined error', () => {
      expect(handleNetworkError(undefined)).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
    });

    it('recognises a network failure carried by the message alone', () => {
      const error: ServerErrorShape = { message: networkMessage };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.NETWORK]);
    });

    it('treats 599 as the last server-error status', () => {
      const error: StatusCode = { statusCode: 599 };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.SERVER_ERROR]);
    });

    it('does not treat 600 as a server error', () => {
      const error: StatusCode = { statusCode: 600 };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
    });

    it('does not treat 499 as a server error', () => {
      const error: StatusCode = { statusCode: 499 };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
    });

    it('should return server error for 502 status', () => {
      const error: StatusCode = { statusCode: 502 };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.SERVER_ERROR]);
    });

    it('should return server error for 504 status', () => {
      const error: StatusCode = { statusCode: 504 };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.SERVER_ERROR]);
    });

    it('should return "went wrong" error for undefined statusCode', () => {
      const error: ServerErrorShape = { message: 'Some error' };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
    });

    it('should return network error for "network request failed" message', () => {
      const error: ServerErrorShape = { statusCode: 400, message: 'Network request failed' };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.NETWORK]);
    });

    it('should return network error for "fetch failed" message', () => {
      const error: ServerErrorShape = { statusCode: 400, message: 'Fetch failed' };
      expect(handleNetworkError(error)).toBe(messages[CLIENT_ERROR_KEYS.NETWORK]);
    });
  });

  describe('handleApolloError', () => {
    let messages: ClientErrorMessages;
    let combinedGraphQLErrorsSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.clearAllMocks();
      messages = getClientErrorMessages();
      // Mock CombinedGraphQLErrors.is to recognize our mock errors
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

    // Apollo Client 4: Network errors are returned directly without networkError wrapper
    it('should handle network error with statusCode (Apollo Client 4 direct error)', () => {
      const error: ServerErrorShape = {
        statusCode: HTTPStatusCodes.UNAUTHORIZED,
        message: 'Network Error',
      };

      const props: HandleApolloErrorProps = { error };
      expect(handleApolloError(props)).toBe(messages[CLIENT_ERROR_KEYS.UNAUTHORIZED]);
    });

    // Apollo Client 4: GraphQL errors use CombinedGraphQLErrors
    it('should handle graphQLErrors with statusCode', () => {
      const graphQLError: GraphQLFormattedError = {
        message: 'Server Error',
        extensions: { statusCode: HTTPStatusCodes.INTERNAL_SERVER_ERROR },
      };
      const error: HandleApolloErrorProps = {
        error: createMockCombinedGraphQLErrors([graphQLError]),
      };
      expect(handleApolloError(error)).toBe(messages[CLIENT_ERROR_KEYS.SERVER_ERROR]);
    });

    it('should handle graphQLErrors without statusCode but with UNAUTHORIZED message', () => {
      const graphQLError: GraphQLFormattedError = {
        message: 'UNAUTHORIZED',
      };
      const error: HandleApolloErrorProps = {
        error: createMockCombinedGraphQLErrors([graphQLError]),
      };
      expect(handleApolloError(error)).toBe(messages[CLIENT_ERROR_KEYS.UNAUTHORIZED]);
    });

    it('never surfaces raw server messages, however many arrive (#378 F2)', () => {
      const graphQLErrors: GraphQLFormattedError[] = [
        { message: 'Error 1' },
        { message: 'Error 2' },
      ];
      const error: HandleApolloErrorProps = {
        error: createMockCombinedGraphQLErrors(graphQLErrors),
      };

      const result: string = handleApolloError(error);

      expect(result).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
      expect(result).not.toContain('Error 1');
      expect(result).not.toContain('Error 2');
    });

    it('does not leak an account-enumeration signal from an unmapped server error', () => {
      const enumerationMessage: string = 'user with this email already exists';
      const error: HandleApolloErrorProps = {
        error: createMockCombinedGraphQLErrors([{ message: enumerationMessage }]),
      };

      const result: string = handleApolloError(error);

      expect(result).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
      expect(result).not.toContain('email');
    });

    it('should return unexpected error for non-ApolloError', () => {
      const error: HandleApolloErrorProps = { error: null };
      expect(handleApolloError(error)).toBe(messages[CLIENT_ERROR_KEYS.UNEXPECTED]);

      const notApolloError: HandleApolloErrorProps = { error: {} };
      expect(handleApolloError(notApolloError)).toBe(messages[CLIENT_ERROR_KEYS.UNEXPECTED]);
    });

    // A function is the only non-object value that can carry properties, so it
    // is the one probe that separates the object guard from the shape checks
    // behind it: those properties must never be read.
    it('never reads properties off a non-object error', () => {
      const error: unknown = Object.assign((): void => {}, { message: networkMessage });
      expect(handleApolloError({ error })).toBe(messages[CLIENT_ERROR_KEYS.UNEXPECTED]);
    });

    it('falls through to the unexpected message when the GraphQL error list is empty', () => {
      const error: HandleApolloErrorProps = { error: createMockCombinedGraphQLErrors([]) };
      expect(handleApolloError(error)).toBe(messages[CLIENT_ERROR_KEYS.UNEXPECTED]);
    });

    it('maps a GraphQL error that arrives without a message to the generic message', () => {
      const malformed: GraphQLFormattedError = {} as GraphQLFormattedError;
      const error: HandleApolloErrorProps = {
        error: createMockCombinedGraphQLErrors([malformed]),
      };
      expect(handleApolloError(error)).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
    });

    // A status code of the wrong type fails the server-error guard, so the
    // network-pattern fallback is what maps the message.
    it('detects a network pattern in the message of a non-server-shaped object', () => {
      const error: { statusCode: string; message: string } = {
        statusCode: 'not-a-number',
        message: networkMessage,
      };
      expect(handleApolloError({ error })).toBe(messages[CLIENT_ERROR_KEYS.NETWORK]);
    });
    // `extensions` is untyped on the wire; a status code that arrives as a
    // string is not a status code and must not select the server-error copy.
    it('ignores a GraphQL statusCode that is not a number', () => {
      const graphQLError: GraphQLFormattedError = {
        message: 'Service Unavailable',
        extensions: { statusCode: '503' },
      };
      const error: HandleApolloErrorProps = {
        error: createMockCombinedGraphQLErrors([graphQLError]),
      };
      expect(handleApolloError(error)).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
    });

    it('should handle graphQLErrors with FORBIDDEN statusCode', () => {
      const graphQLError: GraphQLFormattedError = {
        message: 'Forbidden Access',
        extensions: { statusCode: HTTPStatusCodes.FORBIDDEN },
      };
      const error: HandleApolloErrorProps = {
        error: createMockCombinedGraphQLErrors([graphQLError]),
      };
      expect(handleApolloError(error)).toBe(messages[CLIENT_ERROR_KEYS.DENIED]);
    });

    // Apollo Client 4: Network error pattern detection via error message
    it('should handle network error pattern in message', () => {
      const error: Error = new Error('Failed to fetch');
      const props: HandleApolloErrorProps = { error };
      expect(handleApolloError(props)).toBe(messages[CLIENT_ERROR_KEYS.NETWORK]);
    });
  });
});
