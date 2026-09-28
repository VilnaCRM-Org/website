/**
 * Integration: the Sentry `beforeSend` / `beforeBreadcrumb` scrubbers
 * (`src/lib/telemetry/{redact,scrub-breadcrumb,scrub-event}.ts`).
 *
 * `pages/_app.tsx` wires both into the single `Sentry.init`, but that file is
 * outside this layer's coverage scope, so the modules are driven here directly.
 * The unit specs under `src/test/unit/telemetry/` pin the behaviour in detail and
 * run the real SDK through the Apollo `ErrorLink`; this spec keeps the layer's
 * 100% gate honest over the same code.
 */
import type { Breadcrumb, ErrorEvent } from '@sentry/react';

import {
  MAX_SCRUB_BREADTH,
  MAX_SCRUB_DEPTH,
  MAX_SCRUB_NODES,
  REDACTED_EMAIL,
  REPEATED,
  TRUNCATED,
  scrubRecord,
  scrubValue,
  stripQuery,
} from '@/lib/telemetry/redact';
import { MAX_ROUTE_TAG_LENGTH, routeOf } from '@/lib/telemetry/route-tag';
import { scrubBreadcrumb } from '@/lib/telemetry/scrub-breadcrumb';
import { scrubEvent } from '@/lib/telemetry/scrub-event';

const EMAIL = 'new.user@example.com';
const PASSWORD = 'Strong-Password-123';
const variables = { input: { email: EMAIL, initials: 'New User', password: PASSWORD } };

const errorEvent = (fields: Omit<ErrorEvent, 'type'>): ErrorEvent => ({
  type: undefined,
  ...fields,
});

function nestedTo(levels: number): unknown {
  let value: unknown = 'leaf';
  for (let level = 0; level < levels; level += 1) value = { next: value };
  return value;
}

describe('integration: Sentry event scrubbing', () => {
  it('strips every sign-up form value from a fully populated error event', () => {
    const scrubbed = scrubEvent(
      errorEvent({
        message: `Duplicate ${EMAIL}`,
        logentry: { message: `Duplicate ${EMAIL}`, params: [EMAIL, 1] },
        exception: { values: [{ type: 'Error', value: `Taken: ${EMAIL}` }, { type: 'Error' }] },
        request: {
          url: 'https://vilnacrm.com/?utm=x',
          method: 'POST',
          data: variables,
          cookies: { session: 'secret' },
          headers: { 'User-Agent': 'jest', Cookie: 'session=secret' },
        },
        extra: { variables, operationName: 'AddUser' },
        contexts: { react: { componentStack: 'at AuthForm' }, apollo: { variables } },
        breadcrumbs: [
          {
            category: 'fetch',
            data: { method: 'POST', url: 'https://api.vilnacrm.com/graphql?op=1', body: '{}' },
          },
          { category: 'console', message: `typed ${EMAIL}`, data: { password: PASSWORD } },
        ],
        user: { id: 'u1', email: EMAIL },
        tags: { feature: 'landing', action: 'graphql' },
      })
    );

    expect(scrubbed).toEqual({
      type: undefined,
      message: `Duplicate ${REDACTED_EMAIL}`,
      logentry: { message: `Duplicate ${REDACTED_EMAIL}`, params: [REDACTED_EMAIL, 1] },
      exception: {
        values: [{ type: 'Error', value: `Taken: ${REDACTED_EMAIL}` }, { type: 'Error' }],
      },
      request: { url: 'https://vilnacrm.com/', method: 'POST', headers: { 'User-Agent': 'jest' } },
      extra: { operationName: 'AddUser' },
      contexts: { react: { componentStack: 'at AuthForm' }, apollo: {} },
      breadcrumbs: [
        { category: 'fetch', data: { method: 'POST', url: 'https://api.vilnacrm.com/graphql' } },
        { category: 'console', message: `typed ${REDACTED_EMAIL}`, data: {} },
      ],
      user: { id: 'u1' },
      tags: { feature: 'landing', action: 'graphql', route: '/' },
    });
    expect(JSON.stringify(scrubbed)).not.toContain(PASSWORD);
  });

  it('handles sparse shapes without inventing fields', () => {
    expect(
      scrubEvent(
        errorEvent({
          logentry: {},
          exception: {},
          request: { headers: { Referer: 'https://vilnacrm.com/' } },
          user: { email: EMAIL },
        })
      )
    ).toEqual({ type: undefined, logentry: {}, exception: {}, request: {}, user: {} });
    expect(scrubEvent(errorEvent({ request: { url: 'https://vilnacrm.com/en' } })).request).toEqual(
      { url: 'https://vilnacrm.com/en' }
    );
    expect(scrubEvent(errorEvent({}))).toEqual({ type: undefined });
  });
});

describe('integration: route tag on error events', () => {
  it('tags the pathname of the page URL and keeps the caller tags', () => {
    const scrubbed = scrubEvent(
      errorEvent({
        request: { url: `https://vilnacrm.com/en?email=${EMAIL}#Contacts` },
        tags: { feature: 'landing', action: 'signup' },
      })
    );

    expect(scrubbed.tags).toEqual({ feature: 'landing', action: 'signup', route: '/en' });
  });

  it('adds no tag without an absolute page URL', () => {
    expect(scrubEvent(errorEvent({ request: { url: '/en' } })).tags).toBeUndefined();
    expect(scrubEvent(errorEvent({ request: { method: 'GET' } })).tags).toBeUndefined();
  });

  it('reads the root of a URL with no path and caps a long path', () => {
    const longPath = `/${'a'.repeat(MAX_ROUTE_TAG_LENGTH)}`;

    expect(routeOf('https://vilnacrm.com')).toBe('/');
    expect(routeOf(`https://vilnacrm.com${longPath}`)).toHaveLength(MAX_ROUTE_TAG_LENGTH);
  });
});

describe('integration: Sentry breadcrumb scrubbing', () => {
  it.each<[string, Breadcrumb, Breadcrumb]>([
    ['xhr without a url', { category: 'xhr', data: { body: '{}' } }, { category: 'xhr', data: {} }],
    [
      'fetch with a non-string url',
      { category: 'fetch', data: { url: 1 } },
      { category: 'fetch', data: { url: 1 } },
    ],
    ['no category', { data: { email: EMAIL, step: 2 } }, { data: { step: 2 } }],
    ['no message or data', { category: 'navigation' }, { category: 'navigation' }],
    [
      'navigation carrying a query and a fragment',
      { category: 'navigation', data: { from: '/?email=x', to: '/en#Contacts', to2: 1 } },
      { category: 'navigation', data: { from: '/', to: '/en' } },
    ],
    [
      'console arguments',
      { category: 'console', data: { arguments: [EMAIL], logger: 'console' } },
      { category: 'console', data: { logger: 'console' } },
    ],
  ])('scrubs a breadcrumb with %s', (_label, input, expected) => {
    expect(scrubBreadcrumb(input)).toEqual(expected);
  });
});

describe('integration: value scrubbing bounds', () => {
  it('strips a fragment and leaves a bare URL alone', () => {
    expect(stripQuery('https://vilnacrm.com/en#Contacts')).toBe('https://vilnacrm.com/en');
    expect(stripQuery('https://vilnacrm.com/en')).toBe('https://vilnacrm.com/en');
  });

  it('passes primitives and null through and truncates past the depth bound', () => {
    expect(scrubValue(null, 0)).toBeNull();
    expect(scrubValue(3, 0)).toBe(3);
    expect(scrubValue([EMAIL], 0)).toEqual([REDACTED_EMAIL]);
    expect(JSON.stringify(scrubValue(nestedTo(MAX_SCRUB_DEPTH + 2), 0))).toContain(TRUNCATED);
  });

  it('marks repeated references, bounds breadth and stops at the node budget', () => {
    const record: Record<string, unknown> = { status: 400 };
    record.self = record;
    const wide = Array.from({ length: MAX_SCRUB_BREADTH + 1 }, (_, index) => ({
      [`k${index}`]: 1,
    }));
    const wideObject = Object.fromEntries(wide.map((entry, index) => [`k${index}`, entry]));

    expect(scrubRecord(record, 1)).toEqual({ status: 400, self: REPEATED });
    expect((scrubValue(wide, 0) as unknown[]).at(-1)).toBe(TRUNCATED);
    expect((scrubValue(wideObject, 0) as Record<string, unknown>)[TRUNCATED]).toBe(TRUNCATED);
    const tree = Array.from({ length: MAX_SCRUB_BREADTH }, () =>
      Array.from({ length: MAX_SCRUB_BREADTH }, () => ({}))
    );
    expect(MAX_SCRUB_BREADTH * (MAX_SCRUB_BREADTH + 1)).toBeGreaterThan(MAX_SCRUB_NODES);
    expect(JSON.stringify(scrubValue(tree, 0))).toContain(TRUNCATED);
  });

  it('drops credential-shaped key variants and keeps exact-name look-alikes', () => {
    expect(
      scrubRecord(
        { refresh_token: 'r', 'set-cookie': 'sid=1', apiKey: 'k', emailVerified: true },
        1
      )
    ).toEqual({ emailVerified: true });
  });

  it('strips the query of an absolute URL string and only redacts other strings', () => {
    expect(scrubValue({ page: 'https://vilnacrm.com/?q=1', note: 'a?b' }, 0)).toEqual({
      page: 'https://vilnacrm.com/',
      note: 'a?b',
    });
  });
});
