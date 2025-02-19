import { MutationResolvers, User, CreateUserInput, WrongInput, CreateUserResponse } from './types';

export const typeDefs: string = `
  type User {
    id: ID!
    confirmed: Boolean!
    email: String!
    initials: String!
  }

  input CreateUserInput {
    email: String!
    initials: String!
    clientMutationId: String!
  }

  type CreateUserPayload {
    user: User!
    clientMutationId: String!
  }

  type Mutation {
    createUser(input: CreateUserInput!): CreateUserPayload!
  }

  type Query {
    _: String
  }
`;


let userCounter:number = 0;
export const users: Map<string, User> = new Map<string, { id: string; email: string; initials: string; confirmed: boolean }>();


export const resolvers: { Mutation: MutationResolvers } = {
  Mutation: {
    createUser: async (_, { input }) => {
      if (users.has(input.email)) {
        throw new Error('A user with this email already exists.');
      }

      try {
        if (!input.email.includes('@')) {
          throw new Error('Invalid email format');
        }
        if (!input.initials.trim()) {
          throw new Error('Initials cannot be empty');
        }

        userCounter += 1;

        const newUser: User = {
          id: `${Date.now()}-${userCounter}`,
          confirmed: true,
          email: input.email,
          initials: input.initials,
        };
        users.set(newUser.email, newUser);

        return {
          user: newUser,
          clientMutationId: input.clientMutationId,
        };
      } catch (error) {
        throw new Error(`Failed to create user: ${error}`);
      }
    },
  },
};

export async function handleResponse<T extends { errors?: { message: string }[] }>(
  response: Response
): Promise<{ result: T; errors?: { message: string }[] }> {
  const result: T = await response.json();
  return { result, errors: result.errors };
}

export async function createUser(
  url: string,
  input: CreateUserInput | WrongInput
): Promise<{ response: Response; result: CreateUserResponse; errors?: { message: string }[] }> {
  const response: Response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        mutation CreateUser($input: CreateUserInput!) {
          createUser(input: $input) {
            user {
              id
              confirmed
              email
              initials
            }
            clientMutationId
          }
        }
      `,
      variables: { input },
    }),
  });
  const { result, errors } = await handleResponse<CreateUserResponse>(response);

  return { response, result, errors };
}
