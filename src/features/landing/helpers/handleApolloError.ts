import { CombinedGraphQLErrors } from '@apollo/client';
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

type StatusCodeHandler = {
  match: (statusCode: number | undefined) => boolean;
  key: keyof ClientErrorMessages;
};

const STATUS_CODE_HANDLERS: StatusCodeHandler[] = [
  { match: (code): boolean => code === HTTPStatusCodes.UNAUTHORIZED, key: CLIENT_ERROR_KEYS.UNAUTHORIZED },
  { match: (code): boolean => code === HTTPStatusCodes.FORBIDDEN, key: CLIENT_ERROR_KEYS.DENIED },
  { match: (code): boolean => typeof code === 'number' && code >= 500 && code < 600, key: CLIENT_ERROR_KEYS.SERVER_ERROR },
];

function getMessageByStatusCode(
  statusCode: number | undefined,
  messages: ClientErrorMessages
): string | null {
  const handler = STATUS_CODE_HANDLERS.find(h => h.match(statusCode));
  return handler ? messages[handler.key] : null;
}

function isNetworkErrorMessage(message: string): boolean {
  const lowered = message.toLowerCase();
  return NETWORK_ERROR_PATTERNS.some(pattern => lowered.includes(pattern));
}

export const handleNetworkError: HandleNetworkErrorType = (
  networkError: HandleNetworkErrorProps
): string => {
  const messages: ClientErrorMessages = getClientErrorMessages();

  if (!isServerError(networkError)) return messages[CLIENT_ERROR_KEYS.WENT_WRONG];

  const { statusCode, message } = networkError;

  const statusMessage = getMessageByStatusCode(statusCode, messages);
  if (statusMessage) return statusMessage;

  if (message && isNetworkErrorMessage(message)) {
    return messages[CLIENT_ERROR_KEYS.NETWORK];
  }

  return messages[CLIENT_ERROR_KEYS.WENT_WRONG];
};

function handleGraphQLErrors(
  graphQLErrors: readonly GraphQLFormattedError[],
  messages: ClientErrorMessages
): string | null {
  if (graphQLErrors.length === 0) return null;

  const firstError = graphQLErrors[0];
  const { extensions, message } = firstError;
  const statusCode = extensions?.statusCode as number | undefined;

  const statusMessage = getMessageByStatusCode(statusCode, messages);
  if (statusMessage) return statusMessage;

  if (message?.toUpperCase?.().includes('UNAUTHORIZED')) {
    return messages[CLIENT_ERROR_KEYS.UNAUTHORIZED];
  }

  const combinedMessages = graphQLErrors
    .map((e: GraphQLFormattedError) => e.message || '')
    .filter(Boolean)
    .join(', ');

  return combinedMessages || null;
}

export const handleApolloError: HandleApolloErrorType = ({
  error,
}: HandleApolloErrorProps): string => {
  const messages: ClientErrorMessages = getClientErrorMessages();

  if (!error || typeof error !== 'object') {
    return messages[CLIENT_ERROR_KEYS.UNEXPECTED];
  }

  if (CombinedGraphQLErrors.is(error)) {
    const result = handleGraphQLErrors(error.errors, messages);
    if (result) return result;
  }

  if (isServerError(error)) {
    return handleNetworkError(error);
  }

  const errorMessage = (error as Error).message ?? '';
  if (isNetworkErrorMessage(errorMessage)) {
    return messages[CLIENT_ERROR_KEYS.NETWORK];
  }

  return messages[CLIENT_ERROR_KEYS.UNEXPECTED];
};
