import { DocumentNode, gql } from '@apollo/client';
import { ApolloServer, BaseContext } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

import { CreateUserInput, CreateUserResponse, MutationResolvers } from './types';
import { createUser, handleResponse } from './utils';

const mockResolvers: { Mutation: MutationResolvers } = {
  Mutation: {
    createUser: jest.fn().mockResolvedValue({
      user: {
        id: 'mock-id',
        email: 'mock@example.com',
        initials: 'MO',
        confirmed: true,
      },
      clientMutationId: 'mock-id-123',
    }),
  },
};

const typeDefs: DocumentNode = gql`
  type User {
    id: ID!
    email: String!
    initials: String!
    confirmed: Boolean!
  }

  input CreateUserInput {
    email: String!
    initials: String!
    password: String
    clientMutationId: String
  }

  type CreateUserPayload {
    user: User
    clientMutationId: String
  }

  type Mutation {
    createUser(input: CreateUserInput!): CreateUserPayload!
  }

  type Query {
    _empty: String
  }
`;

async function createTestServer(customResolvers = mockResolvers): Promise<{
  server: ApolloServer<BaseContext>;
  url: string;
  stop: () => Promise<void>;
}> {
  const server: ApolloServer<BaseContext> = new ApolloServer({
    typeDefs,
    resolvers: customResolvers,
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: 0 },
  });

  return {
    server,
    url,
    stop: async (): Promise<void> => {
      await server.stop();
    },
  };
}

describe('Apollo Server - createUser mutation', () => {
  let stopServer: () => Promise<void> = async (): Promise<void> => {};

  afterEach(async () => {
    jest.restoreAllMocks();
    await stopServer();
  });

  it('should return the correct clientMutationId', async () => {
    const mutationId: string = 'mutation-test-123';

    const createUserMock: jest.Mock = jest
      .fn()
      .mockImplementation((_: unknown, args: { input: CreateUserInput }) => ({
        user: {
          id: 'mock-id',
          email: args.input.email,
          initials: args.input.initials,
          confirmed: true,
        },
        clientMutationId: args.input.clientMutationId,
      }));

    const { url, stop } = await createTestServer({
      Mutation: {
        createUser: createUserMock,
      },
    });
    stopServer = stop;

    const { result } = await createUser(url, {
      email: 'clientid@example.com',
      initials: 'CI',
      password: 'qwe123QWE',
      clientMutationId: mutationId,
    });

    expect(result.data.createUser.clientMutationId).toBe(mutationId);
  });
  it('should handle unexpected errors gracefully', async () => {
    const createUserMock: jest.Mock = jest.fn().mockImplementation(() => {
      throw new Error('Database connection lost');
    });

    const { url, stop } = await createTestServer({
      Mutation: {
        createUser: createUserMock,
      },
    });
    stopServer = stop;

    const { errors } = await createUser(url, {
      email: 'error@example.com',
      initials: 'ER',
      password: 'qwe123QWE',
      clientMutationId: 'test-error',
    });

    expect(errors?.[0].message).toContain('Database connection lost');
  });
  it('should successfully create a user', async () => {
    const createUserMock: jest.Mock = jest.fn(
      (_parent: unknown, args: { input: CreateUserInput }) => ({
        user: {
          id: 'user-id-123',
          email: args.input.email,
          initials: args.input.initials,
          confirmed: true,
        },
        clientMutationId: args.input.clientMutationId,
      })
    );

    const { url, stop } = await createTestServer({
      Mutation: {
        createUser: createUserMock,
      },
    });
    stopServer = stop;

    const { result, errors, response } = await createUser(url, {
      email: 'test@example.com',
      initials: 'TE',
      password: 'qwe123QWE',
      clientMutationId: 'test-mutation-1',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    expect(errors).toBeUndefined();
    expect(result.data.createUser).toMatchObject({
      user: {
        confirmed: true,
        email: 'test@example.com',
        initials: 'TE',
      },
      clientMutationId: 'test-mutation-1',
    });
  });
  it('should return an error if email and initials are missing', async () => {
    const { url, stop } = await createTestServer({
      Mutation: {
        createUser: jest.fn(),
      },
    });
    stopServer = stop;

    const { response, errors } = await createUser(url, {
      clientMutationId: 'test-mutation-2',
    } as unknown as CreateUserInput);

    expect(errors).toBeDefined();
    expect(errors?.length).toBeGreaterThan(0);
    expect(errors?.[0].message).toContain(
      'Field "email" of required type "String!" was not provided'
    );
    expect(response.status).toBe(200);
  });

  it('should handle invalid input gracefully', async () => {
    const { url, stop } = await createTestServer({
      Mutation: {
        createUser: jest.fn(),
      },
    });
    stopServer = stop;

    const { response, result, errors } = await createUser(url, { phone: '1234567890' });

    expect(response.status).toBe(200);
    expect(result.errors).toBeDefined();
    expect(errors?.[0].message).toContain(
      'Field "email" of required type "String!" was not provided'
    );
  });
  it('should reject requests without the correct CSRF headers', async () => {
    const { url, stop } = await createTestServer({
      Mutation: {
        createUser: jest.fn(),
      },
    });
    stopServer = stop;

    const response: Response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        query: `mutation {
          createUser(input: {
            email: "test@example.com",
            initials: "TE",
            clientMutationId: "csrf-test"
          }) {
            user { id email initials }
          }
        }`,
      }),
    });

    const { result, errors } = await handleResponse<CreateUserResponse>(response);

    expect(response.status).toBe(400);
    expect(result.errors).toBeDefined();
    expect(errors?.[0]?.message).toContain(
      'This operation has been blocked as a potential Cross-Site Request Forgery (CSRF).'
    );
  });
  it('should return an error for a duplicate email', async () => {
    const existingEmails: Set<string> = new Set(['duplicate@example.com']);

    const createUserMock: jest.Mock = jest.fn(
      (_parent: unknown, args: { input: CreateUserInput }) => {
        if (existingEmails.has(args.input.email)) {
          throw new Error('A user with this email already exists.');
        }
        existingEmails.add(args.input.email);
        return {
          user: {
            id: 'user-id',
            email: args.input.email,
            initials: args.input.initials,
            confirmed: true,
          },
          clientMutationId: args.input.clientMutationId,
        };
      }
    );

    const { url, stop } = await createTestServer({
      Mutation: {
        createUser: createUserMock,
      },
    });
    stopServer = stop;

    await createUser(url, {
      email: 'duplicate@example.com',
      initials: 'D1',
      password: 'qwe123QWE',
      clientMutationId: 'test-mutation-4',
    });

    const { response, result, errors } = await createUser(url, {
      email: 'duplicate@example.com',
      initials: 'D2',
      password: 'qwe123QWE',
      clientMutationId: 'test-mutation-5',
    });

    expect(response.status).toBe(200);
    expect(result.errors).toBeDefined();
    expect(errors?.[0].message).toContain('A user with this email already exists.');
  });

  it('should handle unexpected errors gracefully', async () => {
    const createUserMock: jest.Mock = jest.fn(() => {
      throw new Error('Database connection lost');
    });

    const { url, stop } = await createTestServer({
      Mutation: {
        createUser: createUserMock,
      },
    });
    stopServer = stop;

    const { errors } = await createUser(url, {
      email: 'error@example.com',
      initials: 'ER',
      password: 'qwe123QWE',
      clientMutationId: 'test-error',
    });

    expect(errors).toBeDefined();
    expect(errors?.[0].message).toContain('Database connection lost');
  });
});
