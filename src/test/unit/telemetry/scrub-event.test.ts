import type { Breadcrumb, ErrorEvent } from '@sentry/react';

import {
  MAX_SCRUB_DEPTH,
  REDACTED_EMAIL,
  TRUNCATED,
  redactEmails,
  scrubRecord,
  scrubUrl,
  scrubValue,
  stripQuery,
} from '@/lib/telemetry/redact';
import { scrubBreadcrumb } from '@/lib/telemetry/scrub-breadcrumb';
import { scrubEvent } from '@/lib/telemetry/scrub-event';

const EMAIL = 'new.user@example.com';
const SECOND_EMAIL = 'Олена.Коваль@пошта.укр';
const PASSWORD = 'Strong-Password-123';
const INITIALS = 'New User';

const signUpVariables = {
  input: { email: EMAIL, initials: INITIALS, password: PASSWORD, clientMutationId: 'id-1' },
};

const errorEvent = (fields: Omit<ErrorEvent, 'type'>): ErrorEvent => ({
  type: undefined,
  ...fields,
});

function nestedTo(levels: number): unknown {
  let value: unknown = 'leaf';
  for (let level = 0; level < levels; level += 1) value = { next: value };
  return value;
}

describe('redactEmails', () => {
  it('replaces every email-shaped substring and keeps the surrounding text', () => {
    expect(redactEmails(`A user with email ${EMAIL} or ${SECOND_EMAIL} already exists.`)).toBe(
      `A user with email ${REDACTED_EMAIL} or ${REDACTED_EMAIL} already exists.`
    );
  });

  it('leaves text without an email untouched, including a bare @ handle', () => {
    expect(redactEmails('Response not successful: status 500 @ gateway')).toBe(
      'Response not successful: status 500 @ gateway'
    );
  });

  it('does not treat a domain-less address as an email', () => {
    expect(redactEmails('user@localhost')).toBe('user@localhost');
  });

  it('returns an empty string unchanged', () => {
    expect(redactEmails('')).toBe('');
  });
});

describe('stripQuery / scrubUrl', () => {
  it('drops the query string and the fragment', () => {
    expect(stripQuery('https://vilnacrm.com/?email=a%40b.io#Contacts')).toBe(
      'https://vilnacrm.com/'
    );
    expect(stripQuery('https://vilnacrm.com/en#Contacts')).toBe('https://vilnacrm.com/en');
  });

  it('keeps a URL with neither unchanged', () => {
    expect(stripQuery('https://api.vilnacrm.com/graphql')).toBe('https://api.vilnacrm.com/graphql');
  });

  it('also redacts an email carried in the path', () => {
    expect(scrubUrl(`https://vilnacrm.com/users/${EMAIL}?x=1`)).toBe(
      `https://vilnacrm.com/users/${REDACTED_EMAIL}`
    );
  });
});

describe('scrubValue / scrubRecord', () => {
  it('drops GraphQL variables and credential-named keys at any depth, case-insensitively', () => {
    expect(
      scrubRecord(
        {
          operation: 'SignUp',
          variables: signUpVariables,
          nested: { Password: PASSWORD, Authorization: 'Bearer x', status: 400 },
          list: [{ email: EMAIL, code: 'BAD_USER_INPUT' }],
        },
        1
      )
    ).toEqual({ operation: 'SignUp', nested: { status: 400 }, list: [{ code: 'BAD_USER_INPUT' }] });
  });

  it('redacts emails inside strings of arrays and objects', () => {
    expect(scrubValue({ args: [`sent to ${EMAIL}`, 7] }, 1)).toEqual({
      args: [`sent to ${REDACTED_EMAIL}`, 7],
    });
  });

  it('passes non-string primitives and null through unchanged', () => {
    expect(scrubValue(42, 0)).toBe(42);
    expect(scrubValue(false, 0)).toBe(false);
    expect(scrubValue(null, 0)).toBeNull();
    expect(scrubValue(undefined, 0)).toBeUndefined();
  });

  it('truncates structures nested past the depth bound instead of walking them', () => {
    expect(JSON.stringify(scrubValue(nestedTo(MAX_SCRUB_DEPTH - 1), 0))).toContain('leaf');
    const deep = JSON.stringify(scrubValue(nestedTo(MAX_SCRUB_DEPTH + 2), 0));
    expect(deep).toContain(TRUNCATED);
    expect(deep).not.toContain('leaf');
  });

  it('returns an empty record for an empty input', () => {
    expect(scrubRecord({}, 1)).toEqual({});
  });
});

describe('scrubBreadcrumb', () => {
  it('keeps only method, status and a query-free URL on a fetch breadcrumb', () => {
    const crumb: Breadcrumb = {
      type: 'http',
      category: 'fetch',
      data: {
        method: 'POST',
        url: 'https://api.vilnacrm.com/graphql?op=SignUp',
        status_code: 200,
        request_body_size: 180,
        body: JSON.stringify(signUpVariables),
      },
    };

    expect(scrubBreadcrumb(crumb)).toEqual({
      type: 'http',
      category: 'fetch',
      data: { method: 'POST', url: 'https://api.vilnacrm.com/graphql', status_code: 200 },
    });
  });

  it('drops every payload key on an xhr breadcrumb that carries no URL', () => {
    expect(scrubBreadcrumb({ category: 'xhr', data: { input: signUpVariables.input } })).toEqual({
      category: 'xhr',
      data: {},
    });
  });

  it('keeps a non-string URL value as recorded rather than dropping it', () => {
    expect(scrubBreadcrumb({ category: 'fetch', data: { url: 42 } }).data).toEqual({ url: 42 });
  });

  it('redacts the message and scrubs the data of a non-network breadcrumb', () => {
    expect(
      scrubBreadcrumb({
        category: 'console',
        message: `submitting ${EMAIL}`,
        data: { arguments: [`submitting ${EMAIL}`], password: PASSWORD },
      })
    ).toEqual({
      category: 'console',
      message: `submitting ${REDACTED_EMAIL}`,
      data: { arguments: [`submitting ${REDACTED_EMAIL}`] },
    });
  });

  it('scrubs data on a breadcrumb that has no category', () => {
    expect(scrubBreadcrumb({ data: { email: EMAIL, step: 2 } }).data).toEqual({ step: 2 });
  });

  it('returns an equal breadcrumb when there is no message or data', () => {
    const crumb: Breadcrumb = { category: 'navigation', level: 'info' };
    expect(scrubBreadcrumb(crumb)).toEqual(crumb);
  });
});

describe('scrubEvent', () => {
  it('drops request body, cookies, query string, env and non-allowlisted headers', () => {
    const scrubbed = scrubEvent(
      errorEvent({
        request: {
          url: 'https://vilnacrm.com/?utm=x#Contacts',
          method: 'POST',
          data: signUpVariables,
          cookies: { session: 'secret' },
          query_string: `email=${EMAIL}`,
          env: { REMOTE_ADDR: '10.0.0.1' },
          headers: { 'User-Agent': 'jest', Referer: `https://vilnacrm.com/?email=${EMAIL}` },
        },
      })
    );

    expect(scrubbed.request).toEqual({
      url: 'https://vilnacrm.com/',
      method: 'POST',
      headers: { 'User-Agent': 'jest' },
    });
  });

  it('keeps an empty request empty when it carries no url, method or user agent', () => {
    expect(scrubEvent(errorEvent({ request: { headers: { Cookie: 'a=b' } } })).request).toEqual({});
  });

  it('redacts emails in the message, log entry and exception values but keeps the rest', () => {
    const scrubbed = scrubEvent(
      errorEvent({
        message: `Duplicate ${EMAIL}`,
        logentry: { message: `Duplicate %s`, params: [EMAIL, 3] },
        exception: {
          values: [
            { type: 'Error', value: `A user with email ${EMAIL} already exists.` },
            { type: 'TypeError' },
          ],
        },
        tags: { feature: 'landing', action: 'graphql' },
        release: '1.2.3',
        environment: 'production',
      })
    );

    expect(scrubbed).toEqual({
      type: undefined,
      message: `Duplicate ${REDACTED_EMAIL}`,
      logentry: { message: 'Duplicate %s', params: [REDACTED_EMAIL, 3] },
      exception: {
        values: [
          { type: 'Error', value: `A user with email ${REDACTED_EMAIL} already exists.` },
          { type: 'TypeError' },
        ],
      },
      tags: { feature: 'landing', action: 'graphql' },
      release: '1.2.3',
      environment: 'production',
    });
  });

  it('scrubs a log entry that has params but no message, and one that has neither', () => {
    expect(scrubEvent(errorEvent({ logentry: { params: [EMAIL] } })).logentry).toEqual({
      params: [REDACTED_EMAIL],
    });
    expect(scrubEvent(errorEvent({ logentry: {} })).logentry).toEqual({});
  });

  it('keeps an exception container that carries no values', () => {
    expect(scrubEvent(errorEvent({ exception: {} })).exception).toEqual({});
  });

  it('drops GraphQL variables from extra and contexts but keeps the React component stack', () => {
    const scrubbed = scrubEvent(
      errorEvent({
        extra: { variables: signUpVariables, operationName: 'SignUp' },
        contexts: {
          react: { componentStack: '\n    at AuthForm' },
          graphql: { variables: signUpVariables, operationName: 'SignUp' },
        },
      })
    );

    expect(scrubbed.extra).toEqual({ operationName: 'SignUp' });
    expect(scrubbed.contexts).toEqual({
      react: { componentStack: '\n    at AuthForm' },
      graphql: { operationName: 'SignUp' },
    });
  });

  it('scrubs every breadcrumb the event carries', () => {
    const scrubbed = scrubEvent(
      errorEvent({
        breadcrumbs: [
          { category: 'fetch', data: { method: 'POST', body: JSON.stringify(signUpVariables) } },
          { category: 'console', message: `typed ${EMAIL}` },
        ],
      })
    );

    expect(scrubbed.breadcrumbs).toEqual([
      { category: 'fetch', data: { method: 'POST' } },
      { category: 'console', message: `typed ${REDACTED_EMAIL}` },
    ]);
  });

  it('keeps only the id of the user and drops an id-less user to an empty object', () => {
    expect(
      scrubEvent(errorEvent({ user: { id: 'u1', email: EMAIL, ip_address: '10.0.0.1' } })).user
    ).toEqual({ id: 'u1' });
    expect(scrubEvent(errorEvent({ user: { email: EMAIL } })).user).toEqual({});
  });

  it('returns an already-clean event unchanged', () => {
    const clean = errorEvent({
      event_id: 'abc',
      message: 'Render crash',
      tags: { feature: 'app', action: 'render-crash' },
      exception: { values: [{ type: 'Error', value: 'Cannot read properties of undefined' }] },
      breadcrumbs: [{ category: 'navigation', data: { from: '/', to: '/en' } }],
      contexts: { react: { componentStack: 'at Page' } },
    });

    expect(scrubEvent(clean)).toEqual(clean);
  });

  it('does not mutate the event it is given', () => {
    const event = errorEvent({ message: EMAIL, extra: { variables: signUpVariables } });
    const snapshot = JSON.stringify(event);

    scrubEvent(event);

    expect(JSON.stringify(event)).toBe(snapshot);
  });

  it('leaves no sign-up form value anywhere in a fully populated event', () => {
    const scrubbed = scrubEvent(
      errorEvent({
        message: EMAIL,
        request: { data: signUpVariables, query_string: `email=${EMAIL}` },
        extra: { variables: signUpVariables },
        contexts: { apollo: { input: signUpVariables.input } },
        breadcrumbs: [{ category: 'xhr', data: { body: JSON.stringify(signUpVariables) } }],
        user: { email: EMAIL },
      })
    );
    const serialized = JSON.stringify(scrubbed);

    for (const value of [EMAIL, PASSWORD, INITIALS]) expect(serialized).not.toContain(value);
  });
});
