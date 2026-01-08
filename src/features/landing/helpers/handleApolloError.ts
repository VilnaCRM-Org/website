import { GraphQLFormattedError } from 'graphql';

import {
  ClientErrorMessages,
  getClientErrorMessages,
  CLIENT_ERROR_KEYS,
} from '@/shared/clientErrorMessages';
import HTTPStatusCodes from '@/shared/httpStatusCodes';

export type ServerErrorShape = { statusCode?: number; message?: string };

export function isServerError(error: unknown): error is ServerErrorShape {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const { statusCode, message } = error as { statusCode?: unknown; message?: unknown };

  return (
    (statusCode === undefined || typeof statusCode === 'number') &&
    (message === undefined || typeof message === 'string') &&
    (statusCode !== undefined || message !== undefined)
  );
}

export type HandleApolloErrorProps = { error: unknown };
export type HandleApolloErrorType = (props: HandleApolloErrorProps) => string;

type HandleNetworkErrorProps = ServerErrorShape | unknown;

type HandleNetworkErrorType = (props: HandleNetworkErrorProps) => string;
export const NETWORK_ERROR_PATTERNS: readonly string[] = Object.freeze([
  'failed to fetch',
  'network request failed',
  'fetch failed',
  'network error',
  'request to',
] as const);
export const handleNetworkError: HandleNetworkErrorType = (
  networkError: HandleNetworkErrorProps
): string => {
  const messages: ClientErrorMessages = getClientErrorMessages();

  if (!isServerError(networkError)) return messages[CLIENT_ERROR_KEYS.WENT_WRONG];

  const { statusCode, message } = networkError;
  const loweredMessage: string = message?.toLowerCase() ?? '';

  if (statusCode === HTTPStatusCodes.UNAUTHORIZED) return messages[CLIENT_ERROR_KEYS.UNAUTHORIZED];
  if (statusCode === HTTPStatusCodes.FORBIDDEN) return messages[CLIENT_ERROR_KEYS.DENIED];

  if (statusCode !== undefined && statusCode >= 500 && statusCode < 600) {
    return messages[CLIENT_ERROR_KEYS.SERVER_ERROR];
  }

  if (NETWORK_ERROR_PATTERNS.some(pattern => loweredMessage.includes(pattern))) {
    return messages[CLIENT_ERROR_KEYS.NETWORK];
  }

  return messages[CLIENT_ERROR_KEYS.WENT_WRONG];
};

export const handleApolloError: HandleApolloErrorType = ({
  error,
}: HandleApolloErrorProps): string => {
  const messages: ClientErrorMessages = getClientErrorMessages();

  if (!error || typeof error !== 'object') {
    return messages[CLIENT_ERROR_KEYS.UNEXPECTED];
  }

  const { networkError, graphQLErrors = [] } = error as {
    networkError?: unknown;
    graphQLErrors?: GraphQLFormattedError[];
  };

  if (networkError) return handleNetworkError(networkError);

  if (graphQLErrors.length > 0) {
    const firstError: GraphQLFormattedError = graphQLErrors[0];
    const { extensions, message } = firstError;

    const statusCode: number | undefined = extensions?.statusCode as number | undefined;
    const isServerErrorStatus: boolean =
      typeof statusCode === 'number' && statusCode >= 500 && statusCode < 600;

    if (isServerErrorStatus) {
      return messages[CLIENT_ERROR_KEYS.SERVER_ERROR];
    }
    if (statusCode === HTTPStatusCodes.UNAUTHORIZED) {
      return messages[CLIENT_ERROR_KEYS.UNAUTHORIZED];
    }
    if (statusCode === HTTPStatusCodes.FORBIDDEN) {
      return messages[CLIENT_ERROR_KEYS.DENIED];
    }

    if (message?.toUpperCase?.().includes('UNAUTHORIZED')) {
      return messages[CLIENT_ERROR_KEYS.UNAUTHORIZED];
    }

    return (
      graphQLErrors
        .map((e: GraphQLFormattedError) => e.message || '')
        .filter(Boolean)
        .join(', ') || messages[CLIENT_ERROR_KEYS.UNEXPECTED]
    );
  }

  return messages[CLIENT_ERROR_KEYS.UNEXPECTED];
};
