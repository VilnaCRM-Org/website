/**
 * @jest-environment node
 */
import type { TypedDocumentNode } from '@apollo/client';
import * as Sentry from '@sentry/react';

import { REDACTED_EMAIL } from '@/lib/telemetry/redact';
import { scrubBreadcrumb } from '@/lib/telemetry/scrub-breadcrumb';
import { scrubEvent } from '@/lib/telemetry/scrub-event';

import client from '../../../features/landing/api/graphql/apollo';
import SIGNUP_MUTATION from '../../../features/landing/api/service/userService';

const TEST_DSN = 'https://public@o0.ingest.sentry.io/0';
const GRAPHQL_URL = 'https://api.vilnacrm.com/graphql';

const signUpInput = {
  email: 'new.user@example.com',
  initials: 'New User',
  password: 'Strong-Password-123',
  clientMutationId: 'capture-client-id',
};
const FORM_VALUES = [signUpInput.email, signUpInput.initials, signUpInput.password] as const;

const SIGNUP_OPERATION = SIGNUP_MUTATION as unknown as TypedDocumentNode<
  unknown,
  { input: typeof signUpInput }
>;

const realFetch: typeof fetch = globalThis.fetch;
let envelopes: string[] = [];

function initSentry(scrubbing: boolean): void {
  Sentry.init({
    dsn: TEST_DSN,
    sendDefaultPii: false,
    defaultIntegrations: false,
    transport: options =>
      Sentry.createTransport(options, request => {
        envelopes.push(String(request.body));
        return Promise.resolve({ statusCode: 200 });
      }),
    ...(scrubbing ? { beforeSend: scrubEvent, beforeBreadcrumb: scrubBreadcrumb } : {}),
  });
}

function respondWithDuplicateEmailError(): void {
  const body = JSON.stringify({
    errors: [
      {
        message: `A user with email ${signUpInput.email} already exists.`,
        extensions: { code: 'BAD_USER_INPUT' },
      },
    ],
  });
  globalThis.fetch = jest.fn(() =>
    Promise.resolve(
      new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
    )
  ) as unknown as typeof fetch;
}

async function submitSignUpThatFails(): Promise<string> {
  Sentry.addBreadcrumb({
    type: 'http',
    category: 'fetch',
    data: {
      method: 'POST',
      url: `${GRAPHQL_URL}?operationName=AddUser`,
      status_code: 200,
      body: JSON.stringify({ variables: { input: signUpInput } }),
    },
  });
  Sentry.addBreadcrumb({ category: 'console', message: `submitting ${signUpInput.email}` });
  await client
    .mutate({ mutation: SIGNUP_OPERATION, variables: { input: signUpInput } })
    .catch(() => undefined);
  await Sentry.flush(2000);
  return envelopes.join('\n');
}

beforeEach(() => {
  envelopes = [];
  Sentry.getIsolationScope().clear();
  Sentry.getCurrentScope().clear();
  respondWithDuplicateEmailError();
});

afterEach(async () => {
  await Sentry.close(2000);
  globalThis.fetch = realFetch;
});

describe('sign-up failure reported through the Apollo ErrorLink', () => {
  it('sends one tagged event with no form value once the scrubber is wired', async () => {
    initSentry(true);

    const payload = await submitSignUpThatFails();

    expect(envelopes).toHaveLength(1);
    expect(payload).toContain('"feature":"landing"');
    expect(payload).toContain('"action":"graphql"');
    expect(payload).toContain(`A user with email ${REDACTED_EMAIL} already exists.`);
    expect(payload).toContain(`"url":"${GRAPHQL_URL}"`);
    for (const value of FORM_VALUES) expect(payload).not.toContain(value);
  });

  it('would leak the email without the scrubber, so the check above is not vacuous', async () => {
    initSentry(false);

    const payload = await submitSignUpThatFails();

    expect(envelopes).toHaveLength(1);
    expect(payload).toContain(signUpInput.email);
    expect(payload).toContain(signUpInput.password);
  });
});
