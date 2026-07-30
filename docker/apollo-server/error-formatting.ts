import { randomUUID } from 'node:crypto';

import { ApolloServerErrorCode } from '@apollo/server/errors';
import type { GraphQLFormattedError } from 'graphql';

import { QUERY_GUARD_EXTENSION } from './query-guards.js';

/**
 * Client-facing error shaping for the local Apollo mock (issue #381, F2).
 *
 * The previous implementation replaced the user-facing `message` with a generic
 * string but appended the original, unsanitised `error.message` in a `details`
 * field — an information-exposure sink (CWE-209, OWASP API8:2023) that the client
 * renders verbatim through `handleApolloError`.
 *
 * The rule enforced here: nothing derived from an internal error ever leaves the
 * process. A response carries only
 *
 *   * a stable `extensions.code`,
 *   * a generic, authored `message`,
 *   * a `correlationId` the operator can grep for in the server log,
 *   * an enumerated `reason` when the resolver authored one (see user-input.ts).
 *
 * `details` and Apollo's `stacktrace` extension are stripped unconditionally, so
 * neither can reappear by way of a config change or a future error class.
 */

/** Keys that must never reach a client, whatever produced them. */
const REDACTED_EXTENSIONS: readonly string[] = ['stacktrace', 'exception', 'details'];

const GENERIC_MESSAGES: Readonly<Record<string, string>> = {
  INTERNAL_SERVER_ERROR: 'Something went wrong on the server. Please try again later.',
  BAD_REQUEST: 'The request was invalid. Please check your input.',
  [ApolloServerErrorCode.BAD_USER_INPUT]: 'The request was invalid. Please check your input.',
  [ApolloServerErrorCode.GRAPHQL_VALIDATION_FAILED]:
    "Your query doesn't match the schema. Please check it!",
  [ApolloServerErrorCode.GRAPHQL_PARSE_FAILED]: 'The request could not be parsed.',
};

const FALLBACK_MESSAGE = 'The request could not be completed.';

export interface ErrorLogger {
  error: (message: string, meta?: unknown) => void;
}

function redactExtensions(
  extensions: GraphQLFormattedError['extensions']
): Record<string, unknown> {
  const source: Record<string, unknown> = { ...extensions };
  REDACTED_EXTENSIONS.forEach(key => {
    delete source[key];
  });
  return source;
}

function internalDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
}

/**
 * Query-guard rejections (depth / cost) carry messages this repo authors, so the
 * limit that was breached can be reported without leaking anything. Apollo forces
 * `code: GRAPHQL_VALIDATION_FAILED` onto every validation error, which is why the
 * guard marks itself with its own extension key instead of a custom code.
 */
function isQueryGuardRejection(extensions: Record<string, unknown>): boolean {
  return typeof extensions[QUERY_GUARD_EXTENSION] === 'string';
}

export function createFormatError(
  logger: ErrorLogger = console
): (formattedError: GraphQLFormattedError, error: unknown) => GraphQLFormattedError {
  return (formattedError: GraphQLFormattedError, error: unknown): GraphQLFormattedError => {
    const extensions = redactExtensions(formattedError.extensions);
    const code = typeof extensions.code === 'string' ? extensions.code : 'INTERNAL_SERVER_ERROR';
    const correlationId = randomUUID();

    // The internals stay here, on the server, tied to the id the client is given.
    logger.error(`[graphql] ${code} (correlationId=${correlationId})`, {
      correlationId,
      code,
      detail: internalDetail(error),
    });

    const message = isQueryGuardRejection(extensions)
      ? formattedError.message
      : (GENERIC_MESSAGES[code] ?? FALLBACK_MESSAGE);

    // Rebuilt field by field rather than spread: the removed defect rode out on a
    // top-level `details` key, and a spread would happily carry that — or any future
    // non-spec field — straight back to the client.
    return {
      message,
      ...(formattedError.locations ? { locations: formattedError.locations } : {}),
      ...(formattedError.path ? { path: formattedError.path } : {}),
      extensions: { ...extensions, code, correlationId },
    };
  };
}

/** Default instance used by the server; logs to the console. */
export const formatError: (
  formattedError: GraphQLFormattedError,
  error: unknown
) => GraphQLFormattedError = createFormatError();
