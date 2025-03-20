import { ApolloError } from '@apollo/client';
import { GraphQLFormattedError } from 'graphql';

import { NotificationType } from '../components/Notification/types';

interface HandleErrorProps {
  setErrorDetails: (message: string) => void;
  setNotificationType: (type: NotificationType) => void;
  setIsNotificationOpen: (isOpen: boolean) => void;
}

type HandleNetworkErrorProps = HandleErrorProps & { networkError: ApolloError['networkError'] };
type HandleNetworkErrorType = (props: HandleNetworkErrorProps) => void;

export const handleNetworkError: HandleNetworkErrorType = ({
  networkError,
  setErrorDetails,
  setNotificationType,
  setIsNotificationOpen,
}: HandleNetworkErrorProps): void => {
  if (networkError === null) return;

  if ('statusCode' in networkError && networkError.statusCode === 500) {
    setNotificationType('error');
    setIsNotificationOpen(true);
  } else if (networkError.message.includes('Failed to fetch')) {
    setErrorDetails('Network error. Please check your internet connection.');
  } else {
    setErrorDetails('Something went wrong with the request. Try again later.');
  }
};

export type HandleApolloErrorProps = HandleErrorProps & { err: unknown };
export type HandleApolloErrorType = (props: HandleApolloErrorProps) => void;

export const handleApolloError: HandleApolloErrorType = ({
  err,
  setErrorDetails,
  setNotificationType,
  setIsNotificationOpen,
}: HandleApolloErrorProps): void => {
  if (!(err instanceof ApolloError)) {
    setErrorDetails('An unexpected error occurred. Please try again.');
    return;
  }

  if (err.networkError) {
    const { networkError } = err;
    handleNetworkError({
      networkError,
      setErrorDetails,
      setNotificationType,
      setIsNotificationOpen,
    });
    return;
  }
  if (err.graphQLErrors?.length) {
    const hasServerError: boolean = err.graphQLErrors.some(e => e.extensions?.statusCode === 500);

    if (hasServerError) {
      setNotificationType('error');
      setIsNotificationOpen(true);
      return;
    }

    const message: string = err.graphQLErrors
      .map((e: GraphQLFormattedError) => e.message)
      .join(', ');
    setErrorDetails(message);
  }
};
