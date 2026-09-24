import * as Sentry from '@sentry/react';
import type { ErrorEvent } from '@sentry/react';

import { REDACTED_EMAIL } from '@/lib/telemetry/redact';
import { reportHandledError } from '@/lib/telemetry/report-error';
import { MAX_ROUTE_TAG_LENGTH, routeOf, withRouteTag } from '@/lib/telemetry/route-tag';
import { scrubEvent } from '@/lib/telemetry/scrub-event';

const EMAIL = 'new.user@example.com';
const TEST_DSN = 'https://public@o0.ingest.sentry.io/0';

const errorEvent = (fields: Omit<ErrorEvent, 'type'>): ErrorEvent => ({
  type: undefined,
  ...fields,
});

/**
 * Permission / auth — Not applicable: the tag is derived from the page URL, no user state.
 */
describe('routeOf', () => {
  it.each([
    ['https://vilnacrm.com/en', '/en'],
    ['https://vilnacrm.com/swagger/', '/swagger/'],
    [`https://vilnacrm.com/en?email=${EMAIL}#Contacts`, '/en'],
    ['http://localhost:3000/offline.html#top', '/offline.html'],
    ['HTTPS://VILNACRM.COM/EN', '/EN'],
  ])('reads the pathname of %s', (url: string, expected: string) => {
    expect(routeOf(url)).toBe(expected);
  });

  it.each([
    ['https://vilnacrm.com'],
    ['https://vilnacrm.com?utm=x'],
    ['https://vilnacrm.com#Contacts'],
  ])('reads the site root for %s, which has no path', (url: string) => {
    expect(routeOf(url)).toBe('/');
  });

  it('redacts an email-shaped path segment', () => {
    expect(routeOf(`https://vilnacrm.com/users/${EMAIL}/`)).toBe(`/users/${REDACTED_EMAIL}/`);
  });

  it.each([['/en'], ['about:blank'], ['file:///index.html'], ['']])(
    'returns nothing for %j, which is not an http(s) page URL',
    (url: string) => {
      expect(routeOf(url)).toBeUndefined();
    }
  );

  it('caps the tag at the Sentry tag-value limit', () => {
    const path = `/${'a'.repeat(MAX_ROUTE_TAG_LENGTH * 2)}`;

    expect(routeOf(`https://vilnacrm.com${path}`)).toBe(path.slice(0, MAX_ROUTE_TAG_LENGTH));
    expect(routeOf(`https://vilnacrm.com${path.slice(0, MAX_ROUTE_TAG_LENGTH)}`)).toHaveLength(
      MAX_ROUTE_TAG_LENGTH
    );
  });
});

describe('withRouteTag', () => {
  it('adds the route next to the tags the event already carries', () => {
    const tagged = withRouteTag(
      errorEvent({
        request: { url: 'https://vilnacrm.com/en' },
        tags: { feature: 'landing', action: 'graphql' },
      })
    );

    expect(tagged.tags).toEqual({ feature: 'landing', action: 'graphql', route: '/en' });
  });

  it('replaces a route tag that disagrees with the page URL', () => {
    const tagged = withRouteTag(
      errorEvent({ request: { url: 'https://vilnacrm.com/' }, tags: { route: `/?e=${EMAIL}` } })
    );

    expect(tagged.tags).toEqual({ route: '/' });
  });

  it.each([
    ['no request', errorEvent({ tags: { feature: 'app' } })],
    ['a request without a url', errorEvent({ request: { method: 'GET' } })],
    ['a relative url', errorEvent({ request: { url: '/en' } })],
  ])('returns the event unchanged when it has %s', (_label: string, event: ErrorEvent) => {
    expect(withRouteTag(event)).toBe(event);
  });
});

describe('scrubEvent route tag', () => {
  it('tags the pathname of the scrubbed request URL, never its query or fragment', () => {
    const scrubbed = scrubEvent(
      errorEvent({
        request: { url: `https://vilnacrm.com/en?email=${EMAIL}#Contacts` },
        tags: { feature: 'landing', action: 'signup' },
      })
    );

    expect(scrubbed.tags).toEqual({ feature: 'landing', action: 'signup', route: '/en' });
    expect(JSON.stringify(scrubbed)).not.toContain(EMAIL);
  });

  it('adds no route tag to an event with no request', () => {
    expect(scrubEvent(errorEvent({ tags: { feature: 'app' } })).tags).toEqual({ feature: 'app' });
  });
});

describe('handled-error report sent through the real SDK', () => {
  const realPath = `${window.location.pathname}${window.location.search}`;
  let envelopes: string[] = [];

  beforeEach(() => {
    envelopes = [];
    Sentry.getIsolationScope().clear();
    Sentry.getCurrentScope().clear();
    Sentry.init({
      dsn: TEST_DSN,
      sendDefaultPii: false,
      defaultIntegrations: false,
      integrations: [Sentry.httpContextIntegration()],
      transport: options =>
        Sentry.createTransport(options, request => {
          envelopes.push(String(request.body));
          return Promise.resolve({ statusCode: 200 });
        }),
      beforeSend: scrubEvent,
    });
  });

  afterEach(async () => {
    await Sentry.close(2000);
    window.history.replaceState(null, '', realPath);
  });

  it('carries the page pathname as the route tag and no query-string value', async () => {
    window.history.replaceState(null, '', `/en?email=${encodeURIComponent(EMAIL)}#Contacts`);

    reportHandledError(new Error('mutation failed'), { feature: 'landing', action: 'signup' });
    await Sentry.flush(2000);

    const payload = envelopes.join('\n');
    expect(envelopes).toHaveLength(1);
    expect(payload).toContain('"route":"/en"');
    expect(payload).toContain('"feature":"landing"');
    expect(payload).toContain('"action":"signup"');
    expect(payload).not.toContain(EMAIL);
    expect(payload).not.toContain(encodeURIComponent(EMAIL));
  });
});
