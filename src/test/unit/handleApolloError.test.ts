import { ApolloError } from '@apollo/client';
import { GraphQLFormattedError } from 'graphql';

import { ClientErrorMessages, getClientErrorMessages } from '@/shared/clientErrorMessages';
import { HTTPStatusCodes } from '@/shared/httpStatusCodes';

import {
  handleApolloError,
  HandleApolloErrorProps,
  handleNetworkError,
} from '../../features/landing/helpers/handleApolloError';
import { networkMessage } from '../testing-library/fixtures/errors';

interface StatusCode {
  statusCode: number;
}
interface ErrorType extends StatusCode {
  message: string;
}

describe('Error Handling', () => {
  describe('handleNetworkError', () => {
    let messages: ClientErrorMessages;

    beforeEach(() => {
      jest.clearAllMocks();
      messages = getClientErrorMessages();
    });

    it('should return network error for "Failed to fetch" message', () => {
      const error: ErrorType = { statusCode: 400, message: networkMessage };
      expect(handleNetworkError(error)).toBe(messages.network);
    });

    it('should return unauthorized error for 401 status', () => {
      const error: StatusCode = { statusCode: HTTPStatusCodes.UNAUTHORIZED };
      expect(handleNetworkError(error)).toBe(messages.unauthorized);
    });

    it('should return forbidden error for 403 status', () => {
      const error: StatusCode = { statusCode: HTTPStatusCodes.FORBIDDEN };
      expect(handleNetworkError(error)).toBe(messages.denied);
    });

    it('should return server error for 500 status', () => {
      const error: StatusCode = { statusCode: HTTPStatusCodes.SERVER_ERROR };
      expect(handleNetworkError(error)).toBe(messages.server_error);
    });

    it('should return "went wrong" error for unknown status', () => {
      const error: StatusCode = { statusCode: 999 };
      expect(handleNetworkError(error)).toBe(messages.went_wrong);
    });

    it('should return unexpected error for non-object input', () => {
      expect(handleNetworkError(null)).toBe(messages.went_wrong);
    });

    it('should return server error for 502 status', () => {
      const error: StatusCode = { statusCode: 502 };
      expect(handleNetworkError(error)).toBe(messages.server_error);
    });

    it('should return server error for 504 status', () => {
      const error: StatusCode = { statusCode: 504 };
      expect(handleNetworkError(error)).toBe(messages.server_error);
    });

    it('should return "went wrong" error for undefined statusCode', () => {
      const error: ErrorType = {
        statusCode: undefined as unknown as number,
        message: 'Some error',
      };
      expect(handleNetworkError(error)).toBe(messages.went_wrong);
    });

    it('should return network error for "network request failed" message', () => {
      const error: ErrorType = { statusCode: 400, message: 'Network request failed' };
      expect(handleNetworkError(error)).toBe(messages.network);
    });

    it('should return network error for "fetch failed" message', () => {
      const error: ErrorType = { statusCode: 400, message: 'Fetch failed' };
      expect(handleNetworkError(error)).toBe(messages.network);
    });
  });

  describe('handleApolloError', () => {
    let messages: ClientErrorMessages;

    beforeEach(() => {
      jest.clearAllMocks();
      messages = getClientErrorMessages();
    });

    it('should handle network error', () => {
      const error: ApolloError = new ApolloError({
        networkError: {
          name: 'ServerError',
          message: 'Network Error',
          statusCode: HTTPStatusCodes.UNAUTHORIZED,
        },
      });

      const props: HandleApolloErrorProps = { error };
      expect(handleApolloError(props)).toBe(messages.unauthorized);
    });

    it('should handle graphQLErrors with statusCode', () => {
      const graphQLError: GraphQLFormattedError = {
        message: 'Server Error',
        extensions: { statusCode: HTTPStatusCodes.SERVER_ERROR },
      };
      const error: HandleApolloErrorProps = {
        error: new ApolloError({ graphQLErrors: [graphQLError] }),
      };
      expect(handleApolloError(error)).toBe(messages.server_error);
    });

    it('should handle graphQLErrors without statusCode but with UNAUTHORIZED message', () => {
      const graphQLError: GraphQLFormattedError = {
        message: 'UNAUTHORIZED',
      };
      const error: HandleApolloErrorProps = {
        error: new ApolloError({ graphQLErrors: [graphQLError] }),
      };
      expect(handleApolloError(error)).toBe(messages.unauthorized);
    });

    it('should handle multiple graphQLErrors and join messages', () => {
      const graphQLErrors: GraphQLFormattedError[] = [
        { message: 'Error 1' },
        { message: 'Error 2' },
      ];
      const error: HandleApolloErrorProps = { error: new ApolloError({ graphQLErrors }) };
      expect(handleApolloError(error)).toBe('Error 1, Error 2');
    });

    it('should return unexpected error for non-ApolloError', () => {
      const error: HandleApolloErrorProps = { error: null };
      expect(handleApolloError(error)).toBe(messages.unexpected);

      const notApolloError: HandleApolloErrorProps = { error: {} as ApolloError };
      expect(handleApolloError(notApolloError)).toBe(messages.unexpected);
    });
    it('should handle graphQLErrors with FORBIDDEN statusCode', () => {
      const graphQLError: GraphQLFormattedError = {
        message: 'Forbidden Access',
        extensions: { statusCode: HTTPStatusCodes.FORBIDDEN },
      };
      const error: HandleApolloErrorProps = {
        error: new ApolloError({ graphQLErrors: [graphQLError] }),
      };
      expect(handleApolloError(error)).toBe(messages.denied);
    });
  });
});
