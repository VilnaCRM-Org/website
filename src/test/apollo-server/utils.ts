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

export const users: { email: string; id: string; initials: string; confirmed: boolean }[] = [];

export const resolvers: { Mutation: MutationResolvers } = {
  Mutation: {
    createUser: async (_, { input }) => {
      if (users.some(user => user.email === input.email)) {
        throw new Error('A user with this email already exists.');
      }

      try {
        const newUser: User = {
          id: (users.length + 1).toString(),
          confirmed: true,
          email: input.email,
          initials: input.initials,
        };
        users.push(newUser);

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
  return { result, errors: result.errors }; // ✅ Now TypeScript knows errors exist
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
