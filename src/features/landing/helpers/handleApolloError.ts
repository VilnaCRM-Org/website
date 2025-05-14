import { ApolloError } from '@apollo/client';
import { GraphQLFormattedError } from 'graphql';
import { t } from 'i18next';

type clientErrorKeys =
  | 'network'
  | 'unauthorized'
  | 'denied'
  | 'unexpected'
  | 'went_wrong'
  | 'server_error';

const clientErrorMessages: Record<clientErrorKeys, string> = {
  unauthorized: t('failure_responses.authentication_errors.unauthorized_access'),
  denied: t('failure_responses.authentication_errors.access_denied'),

  went_wrong: t('failure_responses.client_errors.something_went_wrong'),
  unexpected: t('failure_responses.client_errors.unexpected_error'),

  network: t('failure_responses.network_errors.network_error'),
  server_error: t('failure_responses.server_errors.server_error'),
};

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

export type HandleApolloErrorProps = { error: unknown };
export type HandleApolloErrorType = (props: HandleApolloErrorProps) => string;

enum HTTPStatusCodes {
  SERVER_ERROR = 500,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
}
type HandleNetworkErrorProps = { statusCode?: number; message?: string } | unknown;
type HandleNetworkErrorType = (props: HandleNetworkErrorProps) => string;

export const handleNetworkError: HandleNetworkErrorType = (
  networkError: HandleNetworkErrorProps
): string => {
  if (!isServerError(networkError)) return clientErrorMessages.went_wrong;

  const { statusCode, message } = networkError;

  switch (statusCode) {
    case HTTPStatusCodes.UNAUTHORIZED:
      return clientErrorMessages.unauthorized;
    case HTTPStatusCodes.FORBIDDEN:
      return clientErrorMessages.denied;
    case HTTPStatusCodes.SERVER_ERROR:
      return clientErrorMessages.server_error;
    default:
      if (message?.includes('Failed to fetch')) return clientErrorMessages.network;
      return clientErrorMessages.went_wrong;
  }
};

export const handleApolloError: HandleApolloErrorType = ({
  error,
}: HandleApolloErrorProps): string => {
  if (!(error instanceof ApolloError)) {
    return clientErrorMessages.unexpected;
  }
  const { networkError, graphQLErrors } = error;

  if (networkError) return handleNetworkError(networkError);

  if (graphQLErrors.length > 0) {
    const firstError: GraphQLFormattedError = graphQLErrors[0];
    const { extensions, message } = firstError;

    switch (extensions?.statusCode) {
      case HTTPStatusCodes.SERVER_ERROR:
        return clientErrorMessages.server_error;
      case HTTPStatusCodes.UNAUTHORIZED:
        return clientErrorMessages.unauthorized;
      default:
        if (message.includes('UNAUTHORIZED')) {
          return clientErrorMessages.unauthorized;
        }

        return graphQLErrors.map(e => e.message).join(', ');
    }
  }

  return clientErrorMessages.unexpected;
};
