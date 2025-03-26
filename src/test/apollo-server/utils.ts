import {
  MutationResolvers,
  User,
  CreateUserInput,
  OptionalPhoneInput,
  CreateUserResponse,
} from './types';

const defaultUrlSchema: string =
  'https://raw.githubusercontent.com/VilnaCRM-Org/user-service/main/.github/graphql-spec/spec';
const SCHEMA_URL: string = process.env.GRAPHQL_SCHEMA_URL || defaultUrlSchema;

export async function getRemoteSchema(): Promise<string> {
  const controller: AbortController = new AbortController();
  const timeoutId: NodeJS.Timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response: Response = await fetch(`${SCHEMA_URL}`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      throw new Error(`Failed to fetch schema: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Schema fetch timeout after 5 seconds');
    }
    throw new Error(`Schema fetch failed: ${(error as Error).message}`);
  }
}

let userCounter: number = 0;
export const users: Map<string, User> = new Map<
  string,
  { id: string; email: string; initials: string; confirmed: boolean }
>();

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
  input: CreateUserInput | OptionalPhoneInput
): Promise<{ response: Response; result: CreateUserResponse; errors?: { message: string }[] }> {
  try {
    const response: Response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation CreateUser($input: createUserInput!) {
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
  } catch (err) {
    throw new Error(`Network request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
