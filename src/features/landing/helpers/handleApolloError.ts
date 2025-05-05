import { ApolloError } from '@apollo/client';
import { GraphQLFormattedError } from 'graphql';
import { t } from 'i18next';

import { NotificationStatus } from '../components/Notification/types';

interface HandleErrorProps {
  setServerErrorMessage: (message: string) => void;
  setNotificationType: (type: NotificationStatus) => void;
  setIsNotificationOpen: (isOpen: boolean) => void;
  setErrorText: (message: string) => void;
}

type HandleNetworkErrorProps = HandleErrorProps & { networkError: ApolloError['networkError'] };
type HandleNetworkErrorType = (props: HandleNetworkErrorProps) => void;

export function isServerError(error: unknown): error is { statusCode?: number; message?: string } {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const { statusCode, message } = error as { statusCode?: unknown; message?: unknown };

  return (
    (statusCode === undefined || typeof statusCode === 'number') &&
    (message === undefined || typeof message === 'string')
  );
}

export const handleNetworkError: HandleNetworkErrorType = ({
  networkError,
  setServerErrorMessage,
  setNotificationType,
  setIsNotificationOpen,
  setErrorText,
}: HandleNetworkErrorProps): void => {
  if (networkError === null) return;

  if (!isServerError(networkError)) {
    setServerErrorMessage(t('failure_responses.client_errors.something_went_wrong'));
    return;
  }

  if (networkError.statusCode === 500) {
    setNotificationType(NotificationStatus.ERROR);
    setIsNotificationOpen(true);
    return;
  }

  if (networkError.statusCode === 401) {
    setServerErrorMessage(t('failure_responses.authentication_errors.unauthorized_access'));
    return;
  }

  if (networkError.statusCode === 403) {
    setServerErrorMessage(t('failure_responses.authentication_errors.access_denied'));
    return;
  }

  if (networkError.message?.includes('Failed to fetch')) {
    setErrorText(t('failure_responses.client_errors.network_error'));
    setNotificationType(NotificationStatus.ERROR);
    setIsNotificationOpen(true);
    return;
  }
  setServerErrorMessage(t('failure_responses.client_errors.something_went_wrong'));
};
export type HandleApolloErrorProps = HandleErrorProps & { err: unknown };
export type HandleApolloErrorType = (props: HandleApolloErrorProps) => void;

export const handleApolloError: HandleApolloErrorType = ({
  err,
  setServerErrorMessage,
  setNotificationType,
  setIsNotificationOpen,
  setErrorText,
}: HandleApolloErrorProps): void => {
  if (!(err instanceof ApolloError)) {
    setServerErrorMessage(t('failure_responses.client_errors.unexpected_error'));
    return;
  }

  if (err.networkError) {
    handleNetworkError({
      networkError: err.networkError,
      setServerErrorMessage,
      setNotificationType,
      setIsNotificationOpen,
      setErrorText,
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
  setServerErrorMessage(t('failure_responses.client_errors.unexpected_error'));
};
