import type { Breadcrumb, ErrorEvent } from '@sentry/react';

import {
  MAX_SCRUB_BREADTH,
  MAX_SCRUB_DEPTH,
  MAX_SCRUB_NODES,
  REDACTED_EMAIL,
  REPEATED,
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

const WALK_BUDGET_MS = 500;

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

  it('scans a long run of address characters with no @ or no TLD in linear time', () => {
    const run = 'a'.repeat(200_000);
    const startedAt = performance.now();

    expect(redactEmails(run)).toBe(run);
    expect(redactEmails(`${run}@${run}`)).toBe(`${run}@${run}`);
    expect(performance.now() - startedAt).toBeLessThan(WALK_BUDGET_MS);
  });

  it('redacts the RFC-length tail of an over-long local part and a many-label domain', () => {
    expect(redactEmails(`${'a'.repeat(70)}@mail.dept.example.com`)).toBe(
      `${'a'.repeat(6)}${REDACTED_EMAIL}`
    );
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

  it('marks a self-reference as repeated and walks a wide cyclic object once', () => {
    const node: Record<string, unknown> = {};
    for (let key = 0; key < 25; key += 1) node[`k${key}`] = node;
    const startedAt = performance.now();

    const scrubbed = scrubValue([node], 1) as Record<string, unknown>[];

    expect(performance.now() - startedAt).toBeLessThan(WALK_BUDGET_MS);
    expect(scrubbed[0]).toEqual(Object.fromEntries(Object.keys(node).map(key => [key, REPEATED])));
  });

  it('marks a cycle back to the record itself as repeated', () => {
    const record: Record<string, unknown> = { status: 400 };
    record.self = record;

    expect(scrubRecord(record, 1)).toEqual({ status: 400, self: REPEATED });
  });

  it('walks a shared reference once and marks the later sighting as repeated', () => {
    const shared = { code: 'BAD_USER_INPUT' };

    expect(scrubValue({ first: shared, second: shared }, 1)).toEqual({
      first: { code: 'BAD_USER_INPUT' },
      second: REPEATED,
    });
  });

  it('keeps at most the breadth bound of object entries and flags the rest', () => {
    const wide = Object.fromEntries(
      Array.from({ length: MAX_SCRUB_BREADTH + 5 }, (_, key) => [`k${key}`, key])
    );

    const scrubbed = scrubValue(wide, 1) as Record<string, unknown>;

    expect(Object.keys(scrubbed)).toHaveLength(MAX_SCRUB_BREADTH + 1);
    expect(scrubbed[`k${MAX_SCRUB_BREADTH - 1}`]).toBe(MAX_SCRUB_BREADTH - 1);
    expect(scrubbed).not.toHaveProperty(`k${MAX_SCRUB_BREADTH}`);
    expect(scrubbed[TRUNCATED]).toBe(TRUNCATED);
  });

  it('keeps an object exactly at the breadth bound whole, with no truncation flag', () => {
    const atBound = Object.fromEntries(
      Array.from({ length: MAX_SCRUB_BREADTH }, (_, key) => [`k${key}`, key])
    );

    expect(scrubValue(atBound, 1)).toEqual(atBound);
  });

  it('keeps at most the breadth bound of array items and appends a truncation marker', () => {
    const items = Array.from({ length: MAX_SCRUB_BREADTH + 1 }, (_, index) => index);
    const scrubbed = scrubValue(items, 1) as unknown[];

    expect(scrubbed).toHaveLength(MAX_SCRUB_BREADTH + 1);
    expect(scrubbed.at(-2)).toBe(MAX_SCRUB_BREADTH - 1);
    expect(scrubbed.at(-1)).toBe(TRUNCATED);
    expect(scrubValue(items.slice(0, MAX_SCRUB_BREADTH), 1)).toEqual(
      items.slice(0, MAX_SCRUB_BREADTH)
    );
  });

  it('stops expanding objects once the walk has spent its node budget', () => {
    const tree = Array.from({ length: MAX_SCRUB_BREADTH }, () =>
      Array.from({ length: MAX_SCRUB_BREADTH }, () => ({ leaf: 1 }))
    );
    const startedAt = performance.now();

    const serialized = JSON.stringify(scrubValue(tree, 1));

    expect(performance.now() - startedAt).toBeLessThan(WALK_BUDGET_MS);
    const innerArraysWalked = Math.ceil((MAX_SCRUB_NODES - 1) / (MAX_SCRUB_BREADTH + 1));
    expect(serialized.match(/"leaf"/gu)).toHaveLength(MAX_SCRUB_NODES - 1 - innerArraysWalked);
    expect(serialized).toContain(TRUNCATED);
  });

  it('strips the query and fragment of an absolute URL string wherever it sits', () => {
    expect(
      scrubRecord(
        {
          page: `https://vilnacrm.com/?email=${EMAIL}#Contacts`,
          api: { endpoint: 'HTTP://api.vilnacrm.com/graphql?op=SignUp' },
          note: 'see /docs?tab=1',
        },
        1
      )
    ).toEqual({
      page: 'https://vilnacrm.com/',
      api: { endpoint: 'HTTP://api.vilnacrm.com/graphql' },
      note: 'see /docs?tab=1',
    });
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

  it('keeps only the logger of a console breadcrumb and redacts its message', () => {
    const logged: Record<string, unknown> = { email: EMAIL };
    logged.self = logged;

    expect(
      scrubBreadcrumb({
        category: 'console',
        level: 'error',
        message: `submitting ${EMAIL}`,
        data: { arguments: [`submitting ${EMAIL}`, logged], logger: 'console', password: PASSWORD },
      })
    ).toEqual({
      category: 'console',
      level: 'error',
      message: `submitting ${REDACTED_EMAIL}`,
      data: { logger: 'console' },
    });
  });

  it('strips the query and fragment from both ends of a navigation breadcrumb', () => {
    expect(
      scrubBreadcrumb({
        category: 'navigation',
        data: { from: `/?email=${EMAIL}`, to: '/en#Contacts', state: { email: EMAIL } },
      }).data
    ).toEqual({ from: '/', to: '/en' });
  });

  it('keeps a navigation breadcrumb with a missing or non-string end as recorded', () => {
    expect(scrubBreadcrumb({ category: 'navigation', data: { to: 7 } }).data).toEqual({ to: 7 });
  });

  it('redacts the message and scrubs the data of an uncategorised-shape breadcrumb', () => {
    expect(
      scrubBreadcrumb({
        category: 'ui.click',
        message: `button ${EMAIL}`,
        data: { target: `input[value="${EMAIL}"]`, password: PASSWORD },
      })
    ).toEqual({
      category: 'ui.click',
      message: `button ${REDACTED_EMAIL}`,
      data: { target: `input[value="${REDACTED_EMAIL}"]` },
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
