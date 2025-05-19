import { ApolloError } from '@apollo/client';
import { GraphQLFormattedError } from 'graphql';

import { ClientErrorMessages, getClientErrorMessages } from '@/shared/clientErrorMessages';
import { HTTPStatusCodes } from '@/shared/httpStatusCodes';

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
  const loweredMessage: string = message?.toLowerCase() ?? '';

  if (statusCode === HTTPStatusCodes.UNAUTHORIZED) return messages.unauthorized;
  if (statusCode === HTTPStatusCodes.FORBIDDEN) return messages.denied;

  if (statusCode !== undefined && statusCode >= 500 && statusCode < 600) {
    return messages.server_error;
  }

  if (
    loweredMessage.includes('failed to fetch') ||
    loweredMessage.includes('network request failed') ||
    loweredMessage.includes('fetch failed')
  ) {
    return messages.network;
  }

  return messages.went_wrong;
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
      case HTTPStatusCodes.FORBIDDEN:
        return messages.denied;
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
