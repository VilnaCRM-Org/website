import { ApolloError } from '@apollo/client';
import { GraphQLFormattedError } from 'graphql';

import { NotificationStatus } from '../components/AuthSection/AuthForm/types';
import { NotificationType } from '../components/Notification/types';

interface HandleErrorProps {
  setApiErrorDetails: (message: string) => void;
  setNotificationType: (type: NotificationType) => void;
  setIsNotificationOpen: (isOpen: boolean) => void;
}

type HandleNetworkErrorProps = HandleErrorProps & { networkError: ApolloError['networkError'] };
type HandleNetworkErrorType = (props: HandleNetworkErrorProps) => void;

export const handleNetworkError: HandleNetworkErrorType = ({
  networkError,
  setApiErrorDetails,
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
    setApiErrorDetails('Unauthorized access. Please log in again.');
    return;
  }

  if (serverError.statusCode === 403) {
    setApiErrorDetails('Access denied. You do not have permission to perform this action.');
    return;
  }

  if (serverError.message?.includes('Failed to fetch')) {
    setApiErrorDetails('Network error. Please check your internet connection.');
    return;
  }

  setApiErrorDetails('Something went wrong with the request. Try again later.');
  //
  // if ('statusCode' in networkError && networkError.statusCode === 500) {
  //   setNotificationType(NotificationStatus.ERROR);
  //   setIsNotificationOpen(true);
  // }
  // if (networkError?.message?.includes('Failed to fetch')) {
  //   setErrorDetails('Network error. Please check your internet connection.');
  //   return;
  // }
  //
  // if ('statusCode' in networkError &&  networkError?.statusCode === 401) {
  //   setErrorDetails('Unauthorized access. Please log in again.');
  //   return;
  // }
  //
  // if ( 'statusCode' in networkError &&  networkError?.statusCode === 403) {
  //   setErrorDetails('Access denied. You do not have permission to perform this action.');
  //   return;
  // }
  //
  // setErrorDetails('Something went wrong with the request. Try again later.');
};
// else if (networkError.message.includes('Failed to fetch')) {
//   setErrorDetails('Network error. Please check your internet connection.');
// } else {
//   setErrorDetails('Something went wrong with the request. Try again later.');
// }
export type HandleApolloErrorProps = HandleErrorProps & { err: unknown };
export type HandleApolloErrorType = (props: HandleApolloErrorProps) => void;

export const handleApolloError: HandleApolloErrorType = ({
  err,
  setApiErrorDetails,
  setNotificationType,
  setIsNotificationOpen,
}: HandleApolloErrorProps): void => {
  if (!(err instanceof ApolloError)) {
    setApiErrorDetails('An unexpected error occurred. Please try again.');
    return;
  }

  if (err.networkError) {
    const { networkError } = err;
    handleNetworkError({
      networkError,
      setApiErrorDetails,
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
    setApiErrorDetails(message);
    return;
  }
  setApiErrorDetails('An error occurred with the request. Please try again.');
};
