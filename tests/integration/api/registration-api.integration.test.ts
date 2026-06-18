/**
 * @jest-environment node
 *
 * Integration: registration GraphQL API boundary.
 *
 * Exercises the REAL Apollo Client transport
 * (`src/features/landing/api/graphql/apollo.ts`) together with the real
 * `SIGNUP_MUTATION` document and the real `handleApolloError` mapping, with the
 * network stubbed at the `fetch` boundary. Nothing here is mocked at the Apollo
 * link level, so this verifies wiring that the unit and `testing-library`
 * (MockedProvider) layers cannot reach: the actual HTTP request the client
 * emits and how real Apollo error classes flow back through the app's error
 * translation. See tests/integration/README.md for the layer's scope.
 */
import { CombinedGraphQLErrors } from '@apollo/client';

import { CLIENT_ERROR_KEYS, getClientErrorMessages } from '@/shared/clientErrorMessages';

import client from '../../../src/features/landing/api/graphql/apollo';
import SIGNUP_MUTATION from '../../../src/features/landing/api/service/userService';
import { handleApolloError } from '../../../src/features/landing/helpers/handleApolloError';
import { INTEGRATION_GRAPHQL_URL } from '../setup';
import {
  FetchMock,
  graphqlData,
  graphqlErrors,
  httpError,
  installFetchMock,
  readGraphQLRequest,
  restoreFetch,
} from '../utils/graphql-network';

interface CreateUserResponse {
  createUser: {
    user: {
      id: string;
      email: string;
      initials: string;
      confirmed: boolean;
      __typename: 'User';
    };
    clientMutationId: string;
    __typename: 'createUserPayload';
  };
}

const signUpInput = {
  email: 'new.user@example.com',
  initials: 'New User',
  password: 'Strong-Password-123',
  clientMutationId: 'integration-client-id',
};

function runSignup(): ReturnType<typeof client.mutate<CreateUserResponse>> {
  return client.mutate<CreateUserResponse>({
    mutation: SIGNUP_MUTATION,
    variables: { input: signUpInput },
  });
}

function successPayload(): CreateUserResponse {
  return {
    createUser: {
      user: {
        id: 'user-1',
        email: signUpInput.email,
        initials: signUpInput.initials,
        confirmed: true,
        __typename: 'User',
      },
      clientMutationId: signUpInput.clientMutationId,
      __typename: 'createUserPayload',
    },
  };
}

async function captureError(): Promise<unknown> {
  try {
    await runSignup();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the signup mutation to reject, but it resolved.');
}

describe('integration: registration GraphQL API boundary', () => {
  let fetchMock: FetchMock;
  const messages = getClientErrorMessages();

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  afterEach(async () => {
    restoreFetch();
    // The Apollo client is a module singleton shared across tests; clear its
    // cache so a mutation result cannot leak into a later test.
    await client.clearStore();
  });

  describe('request contract', () => {
    it('POSTs the AddUser operation and variables to the configured endpoint', async () => {
      fetchMock.mockResolvedValue(graphqlData(successPayload()));

      await runSignup();

      const request = readGraphQLRequest(fetchMock);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(request.url).toBe(INTEGRATION_GRAPHQL_URL);
      expect(request.method).toBe('POST');
      expect(request.body.operationName).toBe('AddUser');
      expect(request.body.query).toContain('createUser');
      expect(request.body.variables).toEqual({ input: signUpInput });
    });

    it('forwards the configured i18n language as the Accept-Language header', async () => {
      fetchMock.mockResolvedValue(graphqlData(successPayload()));

      await runSignup();

      const request = readGraphQLRequest(fetchMock);
      // 'uk' is NEXT_PUBLIC_MAIN_LANGUAGE; the client bakes it into the HttpLink
      // header at import time. Pinned to a literal so the assertion is not
      // tautological with the i18n global the client itself read.
      expect(request.headers.get('accept-language')).toBe('uk');
    });
  });

  describe('successful response', () => {
    it('resolves with the typed createUser payload', async () => {
      fetchMock.mockResolvedValue(graphqlData(successPayload()));

      const result = await runSignup();

      expect(result.data?.createUser.user.email).toBe(signUpInput.email);
      expect(result.data?.createUser.user.confirmed).toBe(true);
      expect(result.data?.createUser.clientMutationId).toBe(signUpInput.clientMutationId);
    });
  });

  describe('error translation pipeline', () => {
    it('maps a GraphQL business error to its message via CombinedGraphQLErrors', async () => {
      const message = 'A user with this email already exists.';
      fetchMock.mockResolvedValue(
        graphqlErrors([{ message, extensions: { code: 'BAD_USER_INPUT' } }])
      );

      const error = await captureError();

      expect(CombinedGraphQLErrors.is(error)).toBe(true);
      expect(handleApolloError({ error })).toBe(message);
    });

    it('maps a GraphQL error carrying a 5xx statusCode to the server-error message', async () => {
      fetchMock.mockResolvedValue(
        graphqlErrors([{ message: 'boom', extensions: { statusCode: 500 } }])
      );

      const error = await captureError();

      expect(handleApolloError({ error })).toBe(messages[CLIENT_ERROR_KEYS.SERVER_ERROR]);
    });

    it('maps an HTTP 5xx transport failure to the server-error message', async () => {
      fetchMock.mockResolvedValue(httpError(503));

      const error = await captureError();

      expect(handleApolloError({ error })).toBe(messages[CLIENT_ERROR_KEYS.SERVER_ERROR]);
    });

    it('maps a dropped connection to the network-error message', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      const error = await captureError();

      expect(handleApolloError({ error })).toBe(messages[CLIENT_ERROR_KEYS.NETWORK]);
    });
  });
});
