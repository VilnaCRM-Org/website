import { GraphQLResolveInfo } from 'graphql/type';

export interface CreateUserInput {
  clientMutationId: string;
  email: string;
  initials: string;
  password: string;
}
export interface WrongInput {
  phone?: string;
}
export interface User {
  id: string;
  confirmed: boolean;
  email: string;
  initials: string;
}

interface CreateUserPayload {
  user: User;
  clientMutationId: string;
}

export interface MutationResolvers {
  /**
  * Creates a new user.
  * @returns Promise resolving to CreateUserPayload containing the created user and clientMutationId
  */
  createUser: (
    parent: unknown,
    args: { input: CreateUserInput },
    context: unknown,
    info: GraphQLResolveInfo
  ) => Promise<CreateUserPayload>;
}
export interface CreateUserResponse {
  data: {
    createUser: {
      user: User;
      clientMutationId: string;
    };
  };
  errors?: { message: string }[];
}
