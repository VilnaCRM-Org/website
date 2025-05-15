import { ApolloError } from '@apollo/client';
import { GraphQLFormattedError } from 'graphql';

import {
  ClientErrorMessages,
  getClientErrorMessages,
  HTTPStatusCodes,
} from '@/shared/clientErrorMessages';

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

type HandleNetworkErrorProps = { statusCode?: number; message?: string } | unknown;
type HandleNetworkErrorType = (props: HandleNetworkErrorProps) => string;

export const handleNetworkError: HandleNetworkErrorType = (
  networkError: HandleNetworkErrorProps
): string => {
  const messages: ClientErrorMessages = getClientErrorMessages();

  if (!isServerError(networkError)) return messages.went_wrong;

  const { statusCode, message } = networkError;

  switch (statusCode) {
    case HTTPStatusCodes.UNAUTHORIZED:
      return messages.unauthorized;
    case HTTPStatusCodes.FORBIDDEN:
      return messages.denied;
    case HTTPStatusCodes.SERVER_ERROR:
      return messages.server_error;
    default:
      if (message?.toLowerCase?.().includes('failed to fetch')) return messages.network;
      return messages.went_wrong;
  }
};

export const handleApolloError: HandleApolloErrorType = ({
  error,
}: HandleApolloErrorProps): string => {
  const messages: ClientErrorMessages = getClientErrorMessages();

  if (!(error instanceof ApolloError)) {
    return messages.unexpected;
  }
  const { networkError, graphQLErrors } = error;

  if (networkError) return handleNetworkError(networkError);

  if (graphQLErrors.length > 0) {
    const firstError: GraphQLFormattedError = graphQLErrors[0];
    const { extensions, message } = firstError;

    switch (extensions?.statusCode) {
      case HTTPStatusCodes.SERVER_ERROR:
        return messages.server_error;
      case HTTPStatusCodes.UNAUTHORIZED:
        return messages.unauthorized;
      default:
        if (message?.includes('UNAUTHORIZED')) {
          return messages.unauthorized;
        }

        return (
          graphQLErrors
            .map(e => e.message || '')
            .filter(Boolean)
            .join(', ') || messages.unexpected
        );
    }
  }

  return messages.unexpected;
};
