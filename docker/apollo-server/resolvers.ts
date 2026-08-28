import type { CreateUserInput, CreateUserPayload, User } from './type.js';
import {
  CREATE_USER_REASONS,
  badRequest,
  buildNewUser,
  normalizeEmail,
  validateCreateUserInput,
} from './user-input.js';

/**
 * Resolvers for the local Apollo mock.
 *
 * Kept in its own module (rather than inline in `server.mts`) so the server unit
 * suite can exercise the *real* resolver against the *real* pinned schema instead
 * of a hand-written double that can drift away from it.
 *
 * The store is module-private on purpose. Exporting the Map would hand every
 * in-process consumer a way to write `id` and `confirmed` directly, which is exactly
 * the invariant `user-input.ts` exists to hold — so the only writer is the resolver,
 * and the exports below are read-only or test-scoped.
 */
const users = new Map<string, User>();

/** Read-only lookup by email, in any casing. Returns a copy. */
export function findUser(email: string): User | undefined {
  const stored = users.get(normalizeEmail(email));
  return stored ? { ...stored } : undefined;
}

export function userCount(): number {
  return users.size;
}

/** Test helper: the store is process-global, so specs reset it between cases. */
export function resetUsers(): void {
  users.clear();
}

async function createUser(
  _parent: unknown,
  { input }: { input: CreateUserInput }
): Promise<CreateUserPayload> {
  validateCreateUserInput(input);

  // The store is keyed by the canonical email. Without this check a second signup
  // for the same address would silently overwrite the existing record — the same
  // collide-and-overwrite primitive that client-controlled ids used to give away.
  if (users.has(normalizeEmail(input.email))) {
    throw badRequest(
      'A user with this email already exists.',
      CREATE_USER_REASONS.EMAIL_ALREADY_REGISTERED
    );
  }

  const newUser: User = buildNewUser(input);
  users.set(newUser.email, newUser);

  // A resolver returns the *payload* the schema declares (`createUserPayload`),
  // not a full GraphQL response envelope.
  return {
    user: newUser,
    clientMutationId: input.clientMutationId,
  };
}

export const resolvers = {
  Mutation: {
    createUser,
  },
};
