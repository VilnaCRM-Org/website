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

export const handleNetworkError: HandleNetworkErrorType = ({
  networkError,
  setServerErrorMessage,
  setNotificationType,
  setIsNotificationOpen,
}: HandleNetworkErrorProps): void => {
  if (networkError === null) return;

  const serverError: Partial<{ statusCode: number; message: string }> = networkError as Partial<{
    statusCode: number;
    message: string;
  }>;
  if (serverError.statusCode === 500) {
    setNotificationType(NotificationStatus.ERROR);
    setIsNotificationOpen(true);
    return;
  }

  if (serverError.statusCode === 401) {
    setServerErrorMessage('Unauthorized access. Please log in again.');
    return;
  }

  if (serverError.statusCode === 403) {
    setServerErrorMessage('Access denied. You do not have permission to perform this action.');
    return;
  }

  if (serverError.message?.includes('Failed to fetch')) {
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
    const { networkError } = err;
    handleNetworkError({
      networkError,
      setServerErrorMessage,
      setNotificationType,
      setIsNotificationOpen,
    });
    return;
  }
  if (err.graphQLErrors?.length) {
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
  setServerErrorMessage('An error occurred with the request. Please try again.');
};
