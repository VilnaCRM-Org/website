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
  UNKNOWN_INPUT_PROPERTY: 'UNKNOWN_INPUT_PROPERTY',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_INITIALS: 'INVALID_INITIALS',
  MISSING_PASSWORD: 'MISSING_PASSWORD',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
} as const;

export type CreateUserReason = (typeof CREATE_USER_REASONS)[keyof typeof CREATE_USER_REASONS];

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
 * Rejects any property the pinned schema does not declare. Mass assignment is the
 * defect this guards: without it, an `id` or `confirmed` key riding along in the
 * input object would be copied straight onto the stored record.
 */
export function assertOnlyAllowedProperties(input: Readonly<Record<string, unknown>>): void {
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

export function validateCreateUserInput(input: Readonly<CreateUserInput>): void {
  assertOnlyAllowedProperties(input as Readonly<Record<string, unknown>>);

  if (!input.email || !EMAIL_PATTERN.test(input.email)) {
    throw badRequest('Invalid email format', CREATE_USER_REASONS.INVALID_EMAIL);
  }

  if (!input.initials || input.initials.length < MIN_INITIALS_LENGTH) {
    throw badRequest('Invalid initials', CREATE_USER_REASONS.INVALID_INITIALS);
  }

  // The pinned schema marks `password` non-null; presence is re-checked here so a
  // non-GraphQL caller cannot create a passwordless account. The mock never stores
  // or echoes the value — `User` has no password field, by design.
  if (!input.password) {
    throw badRequest('Password is required', CREATE_USER_REASONS.MISSING_PASSWORD);
  }
}

/**
 * Builds the stored record. `id` comes from the server's own generator and
 * `confirmed` starts `false`; neither is reachable from `input`.
 */
export function buildNewUser(input: Readonly<CreateUserInput>): User {
  return {
    id: uuidv4(),
    confirmed: false,
    email: input.email,
    initials: input.initials,
  };
}
