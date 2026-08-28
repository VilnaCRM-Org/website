import { GraphQLResolveInfo } from 'graphql';

/**
 * Mirrors the pinned user-service `createUserInput`
 * (contracts/user-service/schema.graphql): `clientMutationId` is nullable,
 * everything else is required. There is deliberately no `id` and no `confirmed`
 * here — both are server-owned (see user-input.ts) and must never be assignable
 * from client input.
 */
export interface CreateUserInput {
  email: string;
  initials: string;
  password: string;
  clientMutationId?: string | undefined;
}

export interface User {
  id: string;
  confirmed: boolean;
  email: string;
  initials: string;
}

export interface CreateUserPayload {
  user: User;
  clientMutationId?: string | undefined;
}

export interface CreateUserResponse {
  data: {
    createUser: CreateUserPayload;
  };
  errors?: { message: string }[];
}

export interface MutationResolvers {
  /**
   * Creates a new user.
   *
   * @param parent - The parent object, typically not used in root-level resolvers.
   * @param args - An object containing the `input` field, which holds the user data
   *   required for creation.
   * @param context - The GraphQL execution context, providing access to
   *   authentication, database, loaders, etc.
   * @param info - Information about the GraphQL execution state, including the query
   *   AST and schema details.
   *
   * @returns Promise resolving to `CreateUserPayload` containing the created user and
   *   `clientMutationId`.
   */
  createUser: (
    parent: unknown,
    args: { input: CreateUserInput },
    context: unknown,
    info: GraphQLResolveInfo
  ) => Promise<CreateUserPayload>;
}
