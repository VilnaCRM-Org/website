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
 * translation. It also exercises the real `ErrorLink`, so Sentry is mocked at
 * the module boundary the way `AuthLayoutTelemetry.test.tsx` mocks it.
 */
import { CombinedGraphQLErrors, TypedDocumentNode } from '@apollo/client';
import * as Sentry from '@sentry/react';
import i18n from 'i18next';

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

jest.mock('@sentry/react', () => ({ captureException: jest.fn() }));

const captureException: jest.Mock = Sentry.captureException as unknown as jest.Mock;

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

type SignupVariables = { input: typeof signUpInput };

// SIGNUP_MUTATION is exported as TypedDocumentNode<SignUpInput> (input-shaped);
// retype it to the response so the result is correctly typed without passing
// generics to client.mutate (which Apollo v4 deprecates).
const SIGNUP_OPERATION = SIGNUP_MUTATION as unknown as TypedDocumentNode<
  CreateUserResponse,
  SignupVariables
>;

function runSignup() {
  return client.mutate({
    mutation: SIGNUP_OPERATION,
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
    captureException.mockClear();
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
      // 'uk' is NEXT_PUBLIC_MAIN_LANGUAGE, the language i18next was initialised
      // with. Pinned to a literal so the assertion is not tautological with the
      // i18n global the client itself read.
      expect(request.headers.get('accept-language')).toBe('uk');
    });

    it('reads the language per request, so /en sign-ups negotiate English', async () => {
      // The header used to be baked into the HttpLink at import time, which
      // froze it at the main language for the life of the bundle. The `/en`
      // landing changes the active language after import, so the link must
      // resolve it when the operation runs, not when the module loaded.
      fetchMock.mockResolvedValue(graphqlData(successPayload()));
      const initialLanguage: string = i18n.language;

      try {
        await i18n.changeLanguage('en');
        await runSignup();
      } finally {
        await i18n.changeLanguage(initialLanguage);
      }

      const request = readGraphQLRequest(fetchMock);
      expect(request.headers.get('accept-language')).toBe('en');
    });

    it('falls back to en-US Accept-Language when no i18n language is active', async () => {
      fetchMock.mockResolvedValue(graphqlData(successPayload()));

      await jest.isolateModulesAsync(async () => {
        // Re-import the client with an i18n instance that has no active
        // language, exercising the `language || 'en-US'` fallback in apollo.ts.
        jest.doMock('i18next', () => ({ __esModule: true, default: { language: undefined } }));
        const { default: freshClient } =
          await import('../../../src/features/landing/api/graphql/apollo');
        const { default: freshMutation } =
          await import('../../../src/features/landing/api/service/userService');
        await freshClient.mutate({ mutation: freshMutation, variables: { input: signUpInput } });
      });

      const request = readGraphQLRequest(fetchMock);
      expect(request.headers.get('accept-language')).toBe('en-US');
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
    it('never renders a business error verbatim, so accounts cannot be enumerated', async () => {
      // The server distinguishes "this email is taken" from any other failure;
      // the client must not pass that distinction on to the visitor (#378 F2).
      const message = 'A user with this email already exists.';
      fetchMock.mockResolvedValue(
        graphqlErrors([{ message, extensions: { code: 'BAD_USER_INPUT' } }])
      );

      const error = await captureError();

      expect(CombinedGraphQLErrors.is(error)).toBe(true);
      expect(handleApolloError({ error })).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
      expect(handleApolloError({ error })).not.toBe(message);
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

  describe('telemetry reporting (ErrorLink)', () => {
    it('reports a GraphQL error to Sentry without changing the message the user sees', async () => {
      const message = 'A user with this email already exists.';
      fetchMock.mockResolvedValue(
        graphqlErrors([{ message, extensions: { code: 'BAD_USER_INPUT' } }])
      );

      const error = await captureError();

      expect(captureException).toHaveBeenCalledTimes(1);
      const [, context] = captureException.mock.calls[0] as [unknown, { tags: unknown }];
      expect(context).toMatchObject({ tags: { feature: 'landing', action: 'graphql' } });
      expect(handleApolloError({ error })).toBe(messages[CLIENT_ERROR_KEYS.WENT_WRONG]);
    });

    it('reports a network failure to Sentry with the same static tags', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await captureError();

      expect(captureException).toHaveBeenCalledTimes(1);
      const [, context] = captureException.mock.calls[0] as [unknown, { tags: unknown }];
      expect(context).toMatchObject({ tags: { feature: 'landing', action: 'graphql' } });
    });

    it('reports nothing to Sentry on a successful mutation', async () => {
      fetchMock.mockResolvedValue(graphqlData(successPayload()));

      await runSignup();

      expect(captureException).not.toHaveBeenCalled();
    });

    it('never retries the request after an error, avoiding a duplicate sign-up', async () => {
      fetchMock.mockResolvedValue(
        graphqlErrors([{ message: 'boom', extensions: { code: 'BAD_USER_INPUT' } }])
      );

      await captureError();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
