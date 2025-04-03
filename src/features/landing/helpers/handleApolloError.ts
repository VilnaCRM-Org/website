import { ApolloError } from '@apollo/client';
import { GraphQLFormattedError } from 'graphql';

import { NotificationStatus } from '../components/Notification/types';

interface HandleErrorProps {
  setServerErrorMessage: (message: string) => void;
  setNotificationType: (type: NotificationStatus) => void;
  setIsNotificationOpen: (isOpen: boolean) => void;
}

type HandleNetworkErrorProps = HandleErrorProps & { networkError: ApolloError['networkError'] };
type HandleNetworkErrorType = (props: HandleNetworkErrorProps) => void;

function isServerError(error: unknown): error is Partial<{ statusCode: number; message: string }> {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('statusCode' in error
      ? typeof (error as { statusCode?: unknown }).statusCode === 'number'
      : true) &&
    ('message' in error ? typeof (error as { message?: unknown }).message === 'string' : true)
  );
}

export const handleNetworkError: HandleNetworkErrorType = ({
  networkError,
  setServerErrorMessage,
  setNotificationType,
  setIsNotificationOpen,
}: HandleNetworkErrorProps): void => {
  if (networkError === null) return;

  if (!isServerError(networkError)) {
    setServerErrorMessage('Something went wrong with the request. Try again later.');
    return;
  }

  if (networkError.statusCode === 500) {
    setNotificationType(NotificationStatus.ERROR);
    setIsNotificationOpen(true);
    return;
  }

  if (networkError.statusCode === 401) {
    setServerErrorMessage('Unauthorized access. Please log in again.');
    return;
  }

  if (networkError.statusCode === 403) {
    setServerErrorMessage('Access denied. You do not have permission to perform this action.');
    return;
  }

  if (networkError.message?.includes('Failed to fetch')) {
    setServerErrorMessage('Network error. Please check your internet connection.');
    return;
  }

  setServerErrorMessage('Something went wrong with the request. Try again later.');
};
export type HandleApolloErrorProps = HandleErrorProps & { err: unknown };
export type HandleApolloErrorType = (props: HandleApolloErrorProps) => void;

export const handleApolloError: HandleApolloErrorType = ({
  err,
  setServerErrorMessage,
  setNotificationType,
  setIsNotificationOpen,
}: HandleApolloErrorProps): void => {
  if (!(err instanceof ApolloError)) {
    setServerErrorMessage('An unexpected error occurred. Please try again.');
    return;
  }

  if (err.networkError) {
    handleNetworkError({
      networkError: err.networkError,
      setServerErrorMessage,
      setNotificationType,
      setIsNotificationOpen,
    });
    return;
  }
  if (Array.isArray(err.graphQLErrors) && err.graphQLErrors.length > 0) {
    const hasServerError: boolean = err.graphQLErrors.some(e => e.extensions?.statusCode === 500);

    if (hasServerError) {
      setNotificationType(NotificationStatus.ERROR);
      setIsNotificationOpen(true);
      return;
    }

    const message: string = err.graphQLErrors
      .map((e: GraphQLFormattedError) => e.message)
      .join(', ');
    setServerErrorMessage(message);
    return;
  }
  setServerErrorMessage('An unexpected error occurred. Please try again.');
};
