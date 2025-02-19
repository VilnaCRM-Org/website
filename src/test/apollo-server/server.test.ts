import { ApolloServer, BaseContext } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

import { CreateUserInput, CreateUserResponse } from './types';
import { createUser, handleResponse, resolvers, users, typeDefs } from './utils';

describe('Apollo Server - createUser mutation', () => {
  let testServer: ApolloServer<BaseContext>;
  let url: string;

  beforeAll(async () => {
    testServer = new ApolloServer<BaseContext>({
      typeDefs,
      resolvers,
    });

    const { url: testUrl } = await startStandaloneServer(testServer, {
      listen: { port: 0 },
    });
    url = testUrl;
  });

  afterAll(async () => {
    await testServer.stop();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should successfully create a user', async () => {
    const { result, errors, response } = await createUser(url, {
      email: 'test@example.com',
      initials: 'TE',
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
    const { response, result, errors } = await createUser(url, { phone: '1234567890' });

    expect(response.status).toBe(200);
    expect(result.errors).toBeDefined();

    expect(errors?.length).toBeGreaterThan(0);
    expect(errors?.[0].message).toContain(
      'Field "email" of required type "String!" was not provided'
    );
  });

  it('should reject requests without the correct CSRF headers', async () => {
    const response: Response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Invalid header
      body: JSON.stringify({
        query: `mutation { createUser(input:
        { email: "test@example.com", initials: "TE", clientMutationId: "csrf-test" })
        { user { id email initials } }
        }`,
      }),
    });
    const { result, errors } = await handleResponse<CreateUserResponse>(response);

    expect(response.status).toBe(400); // Expect a Bad Request due to CSRF failure
    expect(result.errors).toBeDefined();
    expect(errors?.[0]?.message).toContain(
      'This operation has been blocked as a potential Cross-Site Request Forgery (CSRF).'
    );
  });

  it('should return the correct clientMutationId', async () => {
    const mutationId: string = 'mutation-test-123';

    const { response, result } = await createUser(url, {
      email: 'clientid@example.com',
      initials: 'CI',
      clientMutationId: mutationId,
    });

    expect(response.status).toBe(200);
    expect(result.data.createUser.clientMutationId).toBe(mutationId);
  });
  it('should return an error for a duplicate email', async () => {
    await createUser(url, {
      email: 'duplicate@example.com',
      initials: 'D1',
      clientMutationId: 'test-mutation-4',
    });

    const { response, result, errors } = await createUser(url, {
      email: 'duplicate@example.com',
      initials: 'D2',
      clientMutationId: 'test-mutation-5',
    });

    expect(response.status).toBe(200);
    expect(result.errors).toBeDefined();

    expect(errors?.length).toBeGreaterThan(0);
    expect(errors?.[0].message).toContain('A user with this email already exists.');
  });


  it('should handle unexpected errors gracefully', async () => {
    jest.spyOn(users, 'set').mockImplementation(() => {
      throw new Error('Database connection lost');
    });

    const { errors } = await createUser(url, {
      email: 'error@example.com',
      initials: 'ER',
      clientMutationId: 'test-error',
    });

    expect(errors).toBeDefined();
    expect(errors?.[0].message).toContain('Failed to create user: Error: Database connection lost');

  });
});
