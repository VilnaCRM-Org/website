import { randomUUID } from 'node:crypto';

import { ApolloServerErrorCode } from '@apollo/server/errors';
import type { GraphQLFormattedError } from 'graphql';

import { QUERY_GUARDS, QUERY_GUARD_EXTENSION, isQueryGuard } from './query-guards.js';
import { isCreateUserReason } from './user-input.js';

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
 * Both levels of the response are rebuilt field by field from an allow-list, so
 * `details`, Apollo's `stacktrace`, and anything a future error class or dependency
 * bump introduces cannot reappear by way of a config change.
 */

/**
 * Extension keys a client may see, each paired with a predicate that must accept the
 * value. An ALLOW-list, and a value-checked one: a key check alone would still let a
 * resolver mistake put an arbitrary object — or an internal detail — under a
 * permitted name. Only own, recognised, enumerated values are copied. `code` and
 * `correlationId` are added explicitly afterwards.
 */
const ALLOWED_EXTENSIONS: ReadonlyArray<readonly [string, (value: unknown) => boolean]> = [
  ['reason', isCreateUserReason],
  [QUERY_GUARD_EXTENSION, isQueryGuard],
];

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

function safeExtensions(extensions: GraphQLFormattedError['extensions']): Record<string, unknown> {
  const source: Record<string, unknown> = extensions ?? {};
  const safe: Record<string, unknown> = {};

  ALLOWED_EXTENSIONS.forEach(([key, accepts]) => {
    // `hasOwn`, not `in`: an inherited property is not something this process put there.
    if (!Object.hasOwn(source, key)) return;

    const value = source[key];
    if (accepts(value)) safe[key] = value;
  });

  return safe;
}

function internalDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
}

/**
 * A query-guard rejection is reported as *why* it was rejected, using a message
 * written here — not the rule's own message. Forwarding `formattedError.message`
 * whenever a `queryGuard` extension was present would have made the sanitisation
 * opt-out-able by any error that happened to carry that key. The rule's detailed
 * message (with the exact limits) still reaches the server log.
 *
 * Apollo forces `code: GRAPHQL_VALIDATION_FAILED` onto every validation error,
 * which is why the guard marks itself with its own extension key rather than a
 * custom code.
 */
const QUERY_GUARD_MESSAGES: Readonly<Record<string, string>> = {
  [QUERY_GUARDS.DEPTH]: 'The query is nested too deeply.',
  [QUERY_GUARDS.COST]: 'The query is too expensive to execute.',
  [QUERY_GUARDS.PAGE_SIZE]: 'The requested page size is too large.',
};

function queryGuardMessage(extensions: Record<string, unknown>): string | undefined {
  const guard = extensions[QUERY_GUARD_EXTENSION];
  return isQueryGuard(guard) ? QUERY_GUARD_MESSAGES[guard] : undefined;
}

export function createFormatError(
  logger: ErrorLogger = console
): (formattedError: GraphQLFormattedError, error: unknown) => GraphQLFormattedError {
  return (formattedError: GraphQLFormattedError, error: unknown): GraphQLFormattedError => {
    const rawCode = formattedError.extensions?.code;
    const code = typeof rawCode === 'string' ? rawCode : 'INTERNAL_SERVER_ERROR';
    const extensions = safeExtensions(formattedError.extensions);
    const correlationId = randomUUID();

    // The internals stay here, on the server, tied to the id the client is given.
    logger.error(`[graphql] ${code} (correlationId=${correlationId})`, {
      correlationId,
      code,
      detail: internalDetail(error),
    });

    const message = queryGuardMessage(extensions) ?? GENERIC_MESSAGES[code] ?? FALLBACK_MESSAGE;

    // Rebuilt field by field rather than spread, at both levels: the removed defect
    // rode out on a top-level `details` key, and a spread would happily carry that —
    // or any future non-spec field — straight back to the client.
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
