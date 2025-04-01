import { ApolloError, ServerError, ServerParseError } from '@apollo/client';

import { NotificationStatus } from '../../features/landing/components/AuthSection/AuthForm/types';
import {
  handleApolloError,
  handleNetworkError,
} from '../../features/landing/helpers/handleApolloError';

type NetworkErrorType = Error | ServerParseError | ServerError | null;

describe('Error Handling', () => {
  let setApiErrorDetailsMock: jest.Mock;
  let setNotificationTypeMock: jest.Mock;
  let setIsNotificationOpenMock: jest.Mock;

  beforeEach(() => {
    setApiErrorDetailsMock = jest.fn();
    setNotificationTypeMock = jest.fn();
    setIsNotificationOpenMock = jest.fn();
  });

  describe('handleNetworkError', () => {
    it('should do nothing if networkError is null', () => {
      handleNetworkError({
        networkError: null,
        setApiErrorDetails: setApiErrorDetailsMock,
        setNotificationType: setNotificationTypeMock,
        setIsNotificationOpen: setIsNotificationOpenMock,
      });

      expect(setApiErrorDetailsMock).not.toHaveBeenCalled();
      expect(setNotificationTypeMock).not.toHaveBeenCalled();
      expect(setIsNotificationOpenMock).not.toHaveBeenCalled();
    });

    it('should set notification type as error and open notification if statusCode is 500', () => {
      const networkError: NetworkErrorType = { statusCode: 500 } as ApolloError['networkError'];

      handleNetworkError({
        networkError,
        setApiErrorDetails: setApiErrorDetailsMock,
        setNotificationType: setNotificationTypeMock,
        setIsNotificationOpen: setIsNotificationOpenMock,
      });

      expect(setNotificationTypeMock).toHaveBeenCalledWith(NotificationStatus.ERROR);
      expect(setIsNotificationOpenMock).toHaveBeenCalledWith(true);
      expect(setApiErrorDetailsMock).not.toHaveBeenCalled();
    });

    it('should set error details for network error message "Failed to fetch"', () => {
      const networkError: NetworkErrorType = {
        message: 'Failed to fetch',
      } as ApolloError['networkError'];

      handleNetworkError({
        networkError,
        setApiErrorDetails: setApiErrorDetailsMock,
        setNotificationType: setNotificationTypeMock,
        setIsNotificationOpen: setIsNotificationOpenMock,
      });

      expect(setApiErrorDetailsMock).toHaveBeenCalledWith(
        'Network error. Please check your internet connection.'
      );
    });

    it('should set a generic error message for unknown network errors', () => {
      const networkError: NetworkErrorType = {
        message: 'Some unknown network error',
      } as ApolloError['networkError'];

      handleNetworkError({
        networkError,
        setApiErrorDetails: setApiErrorDetailsMock,
        setNotificationType: setNotificationTypeMock,
        setIsNotificationOpen: setIsNotificationOpenMock,
      });

      expect(setApiErrorDetailsMock).toHaveBeenCalledWith(
        'Something went wrong with the request. Try again later.'
      );
    });

    it('should set a specific message for 401 Unauthorized errors', () => {
      const networkError: NetworkErrorType = { statusCode: 401 } as ApolloError['networkError'];

      handleNetworkError({
        networkError,
        setApiErrorDetails: setApiErrorDetailsMock,
        setNotificationType: setNotificationTypeMock,
        setIsNotificationOpen: setIsNotificationOpenMock,
      });

      expect(setApiErrorDetailsMock).toHaveBeenCalledWith(
        'Unauthorized access. Please log in again.'
      );
    });
    it('should set a specific message for 403 Forbidden errors', () => {
      const networkError: NetworkErrorType = { statusCode: 403 } as ApolloError['networkError'];

      handleNetworkError({
        networkError,
        setApiErrorDetails: setApiErrorDetailsMock,
        setNotificationType: setNotificationTypeMock,
        setIsNotificationOpen: setIsNotificationOpenMock,
      });

      expect(setApiErrorDetailsMock).toHaveBeenCalledWith(
        'Access denied. You do not have permission to perform this action.'
      );
    });

    it('should set a generic message for non-500 HTTP errors', () => {
      const networkError: NetworkErrorType = { statusCode: 429 } as ApolloError['networkError'];

      handleNetworkError({
        networkError,
        setApiErrorDetails: setApiErrorDetailsMock,
        setNotificationType: setNotificationTypeMock,
        setIsNotificationOpen: setIsNotificationOpenMock,
      });

      expect(setApiErrorDetailsMock).toHaveBeenCalledWith(
        'Something went wrong with the request. Try again later.'
      );
    });

    it('should handle an empty or unexpected networkError object gracefully', () => {
      const networkError: NetworkErrorType = {} as ApolloError['networkError'];

      handleNetworkError({
        networkError,
        setApiErrorDetails: setApiErrorDetailsMock,
        setNotificationType: setNotificationTypeMock,
        setIsNotificationOpen: setIsNotificationOpenMock,
      });

      expect(setApiErrorDetailsMock).toHaveBeenCalledWith(
        'Something went wrong with the request. Try again later.'
      );
    });
  });

  describe('handleApolloError', () => {
    it('should call handleNetworkError if networkError is present in ApolloError', () => {
      const networkError: NetworkErrorType = {
        message: 'Failed to fetch',
      } as ApolloError['networkError'];
      const apolloError: ApolloError = new ApolloError({
        networkError,
        graphQLErrors: [],
      });

      handleApolloError({
        err: apolloError,
        setApiErrorDetails: setApiErrorDetailsMock,
        setNotificationType: setNotificationTypeMock,
        setIsNotificationOpen: setIsNotificationOpenMock,
      });

      expect(setNotificationTypeMock).not.toHaveBeenCalled();
      expect(setIsNotificationOpenMock).not.toHaveBeenCalled();
      expect(setApiErrorDetailsMock).toHaveBeenCalled();
      expect(setApiErrorDetailsMock).toHaveBeenCalledWith(
        'Network error. Please check your internet connection.'
      );
    });

    it('should handle GraphQL errors and set the error details properly', () => {
      const apolloError: ApolloError = new ApolloError({
        networkError: null,
        graphQLErrors: [{ message: 'GraphQL error occurred' }],
      });

      handleApolloError({
        err: apolloError,
        setApiErrorDetails: setApiErrorDetailsMock,
        setNotificationType: setNotificationTypeMock,
        setIsNotificationOpen: setIsNotificationOpenMock,
      });

      expect(setApiErrorDetailsMock).toHaveBeenCalledWith('GraphQL error occurred');
    });

    it('should set a generic error if err is not an instance of ApolloError', () => {
      handleApolloError({
        err: new Error('Some unknown error'),
        setApiErrorDetails: setApiErrorDetailsMock,
        setNotificationType: setNotificationTypeMock,
        setIsNotificationOpen: setIsNotificationOpenMock,
      });

      expect(setApiErrorDetailsMock).toHaveBeenCalledWith(
        'An unexpected error occurred. Please try again.'
      );
    });

    it('should set notification type to error and open notification for GraphQL 500 error', () => {
      const apolloError: ApolloError = new ApolloError({
        graphQLErrors: [{ message: 'Internal Server Error', extensions: { statusCode: 500 } }],
      });

      handleApolloError({
        err: apolloError,
        setApiErrorDetails: setApiErrorDetailsMock,
        setNotificationType: setNotificationTypeMock,
        setIsNotificationOpen: setIsNotificationOpenMock,
      });

      expect(setNotificationTypeMock).toHaveBeenCalledWith(NotificationStatus.ERROR);
      expect(setIsNotificationOpenMock).toHaveBeenCalledWith(true);
    });
    it('should set default error message when no networkError or graphQLErrors are present', () => {
      const apolloError: ApolloError = new ApolloError({
        networkError: null,
        graphQLErrors: [],
      });

      handleApolloError({
        err: apolloError,
        setApiErrorDetails: setApiErrorDetailsMock,
        setNotificationType: setNotificationTypeMock,
        setIsNotificationOpen: setIsNotificationOpenMock,
      });

      expect(setApiErrorDetailsMock).toHaveBeenCalledWith(
        'An error occurred with the request. Please try again.'
      );
    });

    it('should combine multiple GraphQL error messages', () => {
      const apolloError: ApolloError = new ApolloError({
        networkError: null,
        graphQLErrors: [{ message: 'Error 1' }, { message: 'Error 2' }],
      });

      handleApolloError({
        err: apolloError,
        setApiErrorDetails: setApiErrorDetailsMock,
        setNotificationType: setNotificationTypeMock,
        setIsNotificationOpen: setIsNotificationOpenMock,
      });

      expect(setApiErrorDetailsMock).toHaveBeenCalledWith('Error 1, Error 2');
    });
  });
});
