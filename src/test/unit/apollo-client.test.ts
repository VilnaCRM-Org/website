/**
 * @jest-environment node
 *
 * Negative / error path — Not applicable: the ErrorLink report path is owned by
 * the telemetry specs; locale variants are the boundary cases covered here.
 */
import type { TypedDocumentNode } from '@apollo/client';
import i18n from 'i18next';

import { env } from '../../config/env';
import client from '../../features/landing/api/graphql/apollo';
import SIGNUP_MUTATION from '../../features/landing/api/service/userService';

type FetchMock = jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>;

const signUpInput = {
  email: 'client.layer@example.com',
  initials: 'Client Layer',
  password: 'Strong-Password-123',
  clientMutationId: 'client-layer-id',
};

const SIGNUP_OPERATION = SIGNUP_MUTATION as unknown as TypedDocumentNode<
  unknown,
  { input: typeof signUpInput }
>;

const createUserPayload = {
  createUser: {
    user: {
      email: signUpInput.email,
      initials: signUpInput.initials,
      id: 'server-issued-id',
      confirmed: false,
      __typename: 'User',
    },
    clientMutationId: signUpInput.clientMutationId,
    __typename: 'createUserPayload',
  },
};

const realFetch: typeof fetch = globalThis.fetch;
let fetchMock: FetchMock;

function installSuccessfulFetch(): FetchMock {
  const mock = jest.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: createUserPayload }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
  ) as unknown as FetchMock;
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

function sentRequest(): { url: string; acceptLanguage: string | null } {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [input, init] = fetchMock.mock.calls[0] as Parameters<typeof fetch>;
  return {
    url: String(input),
    acceptLanguage: new Headers(init?.headers).get('accept-language'),
  };
}

async function signUp(): Promise<void> {
  await client.mutate({ mutation: SIGNUP_OPERATION, variables: { input: signUpInput } });
}

async function signUpWithIsolatedLanguage(language: string | undefined): Promise<void> {
  await jest.isolateModulesAsync(async () => {
    jest.doMock('i18next', () => ({ __esModule: true, default: { language } }));
    const { default: isolatedClient } = await import('../../features/landing/api/graphql/apollo');
    const { default: isolatedMutation } =
      await import('../../features/landing/api/service/userService');
    await isolatedClient.mutate({
      mutation: isolatedMutation as unknown as typeof SIGNUP_OPERATION,
      variables: { input: signUpInput },
    });
  });
}

beforeEach(() => {
  fetchMock = installSuccessfulFetch();
});

afterEach(async () => {
  globalThis.fetch = realFetch;
  await client.clearStore();
});

describe('landing Apollo client request', () => {
  it('posts to the configured GraphQL endpoint, not the HttpLink default', async () => {
    await signUp();

    const { url } = sentRequest();
    expect(url).toBe(env.NEXT_PUBLIC_GRAPHQL_API_URL);
    expect(url).not.toBe('/graphql');
  });

  it('negotiates the main language by default', async () => {
    await signUp();

    expect(sentRequest().acceptLanguage).toBe(env.NEXT_PUBLIC_MAIN_LANGUAGE);
  });

  it('reads the active language per request rather than at import time', async () => {
    const initialLanguage: string = i18n.language;

    try {
      await i18n.changeLanguage('en');
      await signUp();
    } finally {
      await i18n.changeLanguage(initialLanguage);
    }

    expect(sentRequest().acceptLanguage).toBe('en');
  });

  it.each([
    ['no language is active', undefined],
    ['the active language is an empty string', ''],
  ])('falls back to en-US when %s', async (_condition, language) => {
    await signUpWithIsolatedLanguage(language);

    expect(sentRequest().acceptLanguage).toBe('en-US');
  });
});
