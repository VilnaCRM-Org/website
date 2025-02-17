import { GraphQLResolveInfo } from 'graphql/type';

export interface CreateUserInput {
  email: string;
  initials: string;
  clientMutationId: string;
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
      user: {
        id: string;
        confirmed: boolean;
        email: string;
        initials: string;
      };
      clientMutationId: string;
    };
  };
  errors?: { message: string }[];
}
