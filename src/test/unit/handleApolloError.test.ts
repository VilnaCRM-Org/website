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
  ServerErrorShape,
} from '../../features/landing/helpers/handleApolloError';
import { networkMessage } from '../testing-library/fixtures/errors';

type StatusCode = Pick<ServerErrorShape, 'statusCode'>;

describe('Error Handling', () => {
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

    beforeEach(() => {
      jest.clearAllMocks();
      messages = getClientErrorMessages();
    });

    it('should handle network error', () => {
      const error: HandleApolloErrorProps['error'] = {
        networkError: {
          name: 'ServerError',
          message: 'Network Error',
          statusCode: HTTPStatusCodes.UNAUTHORIZED,
        },
      };

      const props: HandleApolloErrorProps = { error };
      expect(handleApolloError(props)).toBe(messages[CLIENT_ERROR_KEYS.UNAUTHORIZED]);
    });

    it('should handle graphQLErrors with statusCode', () => {
      const graphQLError: GraphQLFormattedError = {
        message: 'Server Error',
        extensions: { statusCode: HTTPStatusCodes.INTERNAL_SERVER_ERROR },
      };
      const error: HandleApolloErrorProps = {
        error: { graphQLErrors: [graphQLError] },
      };
      expect(handleApolloError(error)).toBe(messages[CLIENT_ERROR_KEYS.SERVER_ERROR]);
    });

    it('should handle graphQLErrors without statusCode but with UNAUTHORIZED message', () => {
      const graphQLError: GraphQLFormattedError = {
        message: 'UNAUTHORIZED',
      };
      const error: HandleApolloErrorProps = {
        error: { graphQLErrors: [graphQLError] },
      };
      expect(handleApolloError(error)).toBe(messages[CLIENT_ERROR_KEYS.UNAUTHORIZED]);
    });

    it('should handle multiple graphQLErrors and join messages', () => {
      const graphQLErrors: GraphQLFormattedError[] = [
        { message: 'Error 1' },
        { message: 'Error 2' },
      ];
      const error: HandleApolloErrorProps = { error: { graphQLErrors } };
      expect(handleApolloError(error)).toBe('Error 1, Error 2');
    });

    it('should return unexpected error for non-ApolloError', () => {
      const error: HandleApolloErrorProps = { error: null };
      expect(handleApolloError(error)).toBe(messages[CLIENT_ERROR_KEYS.UNEXPECTED]);

      const notApolloError: HandleApolloErrorProps = { error: {} };
      expect(handleApolloError(notApolloError)).toBe(messages[CLIENT_ERROR_KEYS.UNEXPECTED]);
    });
    it('should handle graphQLErrors with FORBIDDEN statusCode', () => {
      const graphQLError: GraphQLFormattedError = {
        message: 'Forbidden Access',
        extensions: { statusCode: HTTPStatusCodes.FORBIDDEN },
      };
      const error: HandleApolloErrorProps = {
        error: { graphQLErrors: [graphQLError] },
      };
      expect(handleApolloError(error)).toBe(messages[CLIENT_ERROR_KEYS.DENIED]);
    });
  });
});
