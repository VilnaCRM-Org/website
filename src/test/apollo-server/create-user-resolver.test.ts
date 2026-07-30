import { resetUsers, users } from '../../../docker/apollo-server/resolvers';

import { CREATE_USER_MUTATION, MockServer, graphqlRequest, startMockServer } from './mock-server';

/**
 * Issue #381 / F1 — HTTP level, against the real resolvers and the real pinned
 * user-service schema (contracts/user-service/schema.graphql).
 *
 * Scenario classes: positive (a signup succeeds and is stored unconfirmed), negative
 * (client-chosen id, mass assignment, duplicate email, malformed input) and boundary
 * (the same clientMutationId twice, an id-shaped clientMutationId).
 *
 * Locale / responsive / a11y — Not applicable: no UI is rendered by this layer.
 */

const signupInput = {
  email: 'signup@example.com',
  initials: 'SU',
  password: 'Strong-Password-123',
  clientMutationId: 'client-mutation-1',
};

interface CreatedUser {
  id: string;
  email: string;
  initials: string;
  confirmed: boolean;
}

function createdUserOf(body: Record<string, unknown>): CreatedUser {
  return (body.data as { createUser: { user: CreatedUser } }).createUser.user;
}

describe('Apollo mock — createUser resolver', () => {
  let server: MockServer;

  beforeEach(async () => {
    resetUsers();
    server = await startMockServer();
  });

  afterEach(async () => {
    await server.stop();
    resetUsers();
  });

  describe('positive path', () => {
    it('returns the created user through the createUserPayload the schema declares', async () => {
      const { status, body } = await graphqlRequest(server.url, CREATE_USER_MUTATION, {
        input: signupInput,
      });

      expect(status).toBe(200);
      expect(body.errors).toBeUndefined();
      expect(createdUserOf(body as Record<string, unknown>)).toMatchObject({
        email: signupInput.email,
        initials: signupInput.initials,
      });
    });

    it('echoes clientMutationId back as an opaque Relay field', async () => {
      const { body } = await graphqlRequest(server.url, CREATE_USER_MUTATION, {
        input: signupInput,
      });

      expect((body.data as { createUser: { clientMutationId: string } }).createUser).toMatchObject({
        clientMutationId: signupInput.clientMutationId,
      });
    });

    it('stores the user under its email', async () => {
      await graphqlRequest(server.url, CREATE_USER_MUTATION, { input: signupInput });

      expect(users.get(signupInput.email)).toMatchObject({ email: signupInput.email });
    });
  });

  describe('the primary key is server-owned', () => {
    it('does not use clientMutationId as the id', async () => {
      const { body } = await graphqlRequest(server.url, CREATE_USER_MUTATION, {
        input: signupInput,
      });

      expect(createdUserOf(body as Record<string, unknown>).id).not.toBe(
        signupInput.clientMutationId
      );
    });

    it('ignores an attacker-chosen, id-shaped clientMutationId', async () => {
      const stolenId = '11111111-2222-4333-8444-555555555555';

      const { body } = await graphqlRequest(server.url, CREATE_USER_MUTATION, {
        input: { ...signupInput, clientMutationId: stolenId },
      });

      expect(createdUserOf(body as Record<string, unknown>).id).not.toBe(stolenId);
    });

    it('issues distinct ids to two signups that reuse one clientMutationId', async () => {
      const first = await graphqlRequest(server.url, CREATE_USER_MUTATION, { input: signupInput });
      const second = await graphqlRequest(server.url, CREATE_USER_MUTATION, {
        input: { ...signupInput, email: 'second@example.com' },
      });

      expect(createdUserOf(first.body as Record<string, unknown>).id).not.toBe(
        createdUserOf(second.body as Record<string, unknown>).id
      );
    });
  });

  describe('email verification cannot be bypassed', () => {
    it('creates the user unconfirmed', async () => {
      const { body } = await graphqlRequest(server.url, CREATE_USER_MUTATION, {
        input: signupInput,
      });

      expect(createdUserOf(body as Record<string, unknown>).confirmed).toBe(false);
      expect(users.get(signupInput.email)?.confirmed).toBe(false);
    });
  });

  describe('mass assignment', () => {
    it.each(['id', 'confirmed'])(
      'rejects a `%s` property smuggled into the input',
      async property => {
        const { status, body } = await graphqlRequest(server.url, CREATE_USER_MUTATION, {
          input: { ...signupInput, [property]: property === 'confirmed' ? true : 'forced-id' },
        });

        expect(status).toBe(400);
        expect(body.errors?.[0]?.message).toBeTruthy();
        expect(users.size).toBe(0);
      }
    );
  });

  describe('negative and boundary input', () => {
    it('rejects a duplicate email instead of overwriting the stored record', async () => {
      const first = await graphqlRequest(server.url, CREATE_USER_MUTATION, { input: signupInput });
      const originalId = createdUserOf(first.body as Record<string, unknown>).id;

      const second = await graphqlRequest(server.url, CREATE_USER_MUTATION, {
        input: { ...signupInput, initials: 'XX' },
      });

      expect(second.body.errors?.[0]?.extensions).toMatchObject({
        reason: 'EMAIL_ALREADY_REGISTERED',
      });
      expect(users.get(signupInput.email)).toMatchObject({ id: originalId, initials: 'SU' });
      expect(users.size).toBe(1);
    });

    it.each([
      ['a malformed email', { email: 'not-an-email' }, 'INVALID_EMAIL'],
      ['one-character initials', { initials: 'S' }, 'INVALID_INITIALS'],
      ['an empty password', { password: '' }, 'MISSING_PASSWORD'],
    ])('rejects %s and stores nothing', async (_label, override, reason) => {
      const { body } = await graphqlRequest(server.url, CREATE_USER_MUTATION, {
        input: { ...signupInput, ...override },
      });

      expect(body.errors?.[0]?.extensions).toMatchObject({ code: 'BAD_REQUEST', reason });
      expect(users.size).toBe(0);
    });

    it('rejects a request missing a schema-required field', async () => {
      const { status, body } = await graphqlRequest(server.url, CREATE_USER_MUTATION, {
        input: { email: signupInput.email, initials: signupInput.initials },
      });

      expect(status).toBe(400);
      expect(body.errors?.length).toBeGreaterThan(0);
      expect(users.size).toBe(0);
    });
  });
});
