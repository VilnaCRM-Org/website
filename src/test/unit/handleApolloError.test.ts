import { ApolloError } from '@apollo/client';
import { GraphQLFormattedError } from 'graphql';

import {
  ClientErrorMessages,
  getClientErrorMessages,
  HTTPStatusCodes,
} from '@/shared/clientErrorMessages';

import {
  handleApolloError,
  HandleApolloErrorProps,
  handleNetworkError,
} from '../../features/landing/helpers/handleApolloError';

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
      const error: ErrorType = { statusCode: 400, message: 'Failed to fetch' };
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
  });
});
