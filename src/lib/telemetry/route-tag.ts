import type { ErrorEvent } from '@sentry/react';

import { redactEmails, stripQuery } from './redact';

export const MAX_ROUTE_TAG_LENGTH: number = 200;

const ORIGIN = /^https?:\/\/[^/?#]*/iu;

export function routeOf(url: string): string | undefined {
  const origin = ORIGIN.exec(url);
  if (origin === null) return undefined;
  const pathname = redactEmails(stripQuery(url.slice(origin[0].length))) || '/';
  return pathname.slice(0, MAX_ROUTE_TAG_LENGTH);
}

export function withRouteTag(event: ErrorEvent): ErrorEvent {
  const url = event.request?.url;
  const route = url === undefined ? undefined : routeOf(url);
  return route === undefined ? event : { ...event, tags: { ...event.tags, route } };
}
