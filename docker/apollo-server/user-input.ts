import { GraphQLError } from 'graphql';
import { v4 as uuidv4 } from 'uuid';

import type { CreateUserInput, User } from './type.js';

/**
 * Input handling for the local Apollo mock's `createUser` mutation (issue #381, F1).
 *
 * `CLAUDE.md` / `agents.md` point autonomous agents at this mock as the canonical
 * shape of the user-service API, so the mock must model the *safe* pattern even
 * though it is never deployed:
 *
 *   * the primary key is generated server-side and is never derived from client
 *     input (OWASP API3:2023 — Broken Object Property Level Authorization);
 *   * `confirmed` starts `false`; only a verified confirmation token may flip it,
 *     so a signup can never self-confirm an email address;
 *   * only the properties the pinned schema declares are accepted — anything else
 *     is rejected instead of silently mass-assigned.
 *
 * GraphQL itself already rejects unknown fields on a strict input object, so the
 * allow-list below is defence in depth: it keeps the guarantee if the resolver is
 * ever reached through a non-GraphQL path (a REST shim, a direct unit call, a
 * looser schema).
 */

/** Every property the pinned `createUserInput` declares. Nothing else is assignable. */
export const CREATE_USER_ALLOWED_PROPERTIES: readonly string[] = [
  'email',
  'initials',
  'password',
  'clientMutationId',
];

/**
 * Stable, enumerated reasons attached to `extensions.reason`. The client-facing
 * `message` stays generic (see error-formatting.ts); these codes are authored
 * here, never derived from an internal error, so they are safe to return.
 */
export const CREATE_USER_REASONS = {
  INVALID_INPUT_TYPE: 'INVALID_INPUT_TYPE',
  UNKNOWN_INPUT_PROPERTY: 'UNKNOWN_INPUT_PROPERTY',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_INITIALS: 'INVALID_INITIALS',
  MISSING_PASSWORD: 'MISSING_PASSWORD',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
} as const;

export type CreateUserReason = (typeof CREATE_USER_REASONS)[keyof typeof CREATE_USER_REASONS];

const CREATE_USER_REASON_VALUES: readonly string[] = Object.values(CREATE_USER_REASONS);

/** True only for a reason this module authored. Used to validate, never to trust. */
export function isCreateUserReason(value: unknown): value is CreateUserReason {
  return typeof value === 'string' && CREATE_USER_REASON_VALUES.includes(value);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_INITIALS_LENGTH = 2;

/** A 400 GraphQLError carrying a stable reason code and no internal detail. */
export function badRequest(message: string, reason: CreateUserReason): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code: 'BAD_REQUEST',
      reason,
      http: { status: 400 },
    },
  });
}

/**
 * Email is the identity key of the store, so it is compared and stored in one
 * canonical form. Without this, `User@Example.com` and `user@example.com` create
 * two records — the same collide-and-shadow outcome the duplicate check exists to
 * prevent. Mailbox providers treat the local part case-insensitively in practice;
 * the domain is case-insensitive by RFC 1035.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Rejects any property the pinned schema does not declare. Mass assignment is the
 * defect this guards: without it, an `id` or `confirmed` key riding along in the
 * input object would be copied straight onto the stored record.
 *
 * The type guard matters for the same reason the allow-list does: a non-GraphQL
 * caller must get the same stable BAD_REQUEST, not a TypeError that surfaces as a
 * generic internal error.
 */
export function assertOnlyAllowedProperties(input: unknown): void {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Input must be an object', CREATE_USER_REASONS.INVALID_INPUT_TYPE);
  }

  const unknownProperties = Object.keys(input).filter(
    key => !CREATE_USER_ALLOWED_PROPERTIES.includes(key)
  );

  if (unknownProperties.length > 0) {
    throw badRequest(
      `Unknown input propert${unknownProperties.length === 1 ? 'y' : 'ies'}: ${unknownProperties
        .slice()
        .sort()
        .join(', ')}`,
      CREATE_USER_REASONS.UNKNOWN_INPUT_PROPERTY
    );
  }
}

/**
 * Every scalar is type-checked, not just tested for truthiness. GraphQL coerces these
 * for us, but the allow-list exists precisely for callers that do not go through
 * GraphQL — and there `[]` or `{}` is truthy, so a presence check alone would let a
 * non-string password satisfy a schema invariant it does not actually meet.
 */
function requireString(value: unknown, message: string, reason: CreateUserReason): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw badRequest(message, reason);
  }
  return value;
}

export function validateCreateUserInput(input: Readonly<CreateUserInput>): void {
  assertOnlyAllowedProperties(input);

  const email = requireString(
    input.email,
    'Invalid email format',
    CREATE_USER_REASONS.INVALID_EMAIL
  );
  if (!EMAIL_PATTERN.test(email)) {
    throw badRequest('Invalid email format', CREATE_USER_REASONS.INVALID_EMAIL);
  }

  const initials = requireString(
    input.initials,
    'Invalid initials',
    CREATE_USER_REASONS.INVALID_INITIALS
  );
  if (initials.length < MIN_INITIALS_LENGTH) {
    throw badRequest('Invalid initials', CREATE_USER_REASONS.INVALID_INITIALS);
  }

  // The pinned schema marks `password` non-null. The mock never stores or echoes the
  // value — `User` has no password field, by design.
  requireString(input.password, 'Password is required', CREATE_USER_REASONS.MISSING_PASSWORD);

  // `clientMutationId` is nullable in the schema, so `null` and `undefined` both round
  // trip. Anything else is echoed back to the client verbatim, so it has to be the
  // opaque string the schema promises.
  const echo: unknown = input.clientMutationId;
  if (echo !== undefined && echo !== null && typeof echo !== 'string') {
    throw badRequest('Invalid clientMutationId', CREATE_USER_REASONS.INVALID_INPUT_TYPE);
  }
}

/**
 * Builds the stored record. `id` comes from the server's own generator and
 * `confirmed` starts `false`; neither is reachable from `input`. The email is
 * canonicalised so the stored record and the duplicate-check key always agree.
 */
export function buildNewUser(input: Readonly<CreateUserInput>): User {
  return {
    id: uuidv4(),
    confirmed: false,
    email: normalizeEmail(input.email),
    initials: input.initials,
  };
}
