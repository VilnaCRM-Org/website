import type { Contexts, ErrorEvent, Exception, RequestEventData, User } from '@sentry/react';

import { redactEmails, scrubRecord, scrubUrl, scrubValue } from './redact';
import { scrubBreadcrumb } from './scrub-breadcrumb';

type EventPatch = Partial<ErrorEvent>;

type LogEntry = NonNullable<ErrorEvent['logentry']>;

const KEPT_REQUEST_HEADER = 'User-Agent';

function scrubRequest(request: RequestEventData): RequestEventData {
  const userAgent = request.headers?.[KEPT_REQUEST_HEADER];
  return {
    ...(request.url === undefined ? {} : { url: scrubUrl(request.url) }),
    ...(request.method === undefined ? {} : { method: request.method }),
    ...(userAgent === undefined ? {} : { headers: { [KEPT_REQUEST_HEADER]: userAgent } }),
  };
}

function scrubException(exception: Exception): Exception {
  return exception.value === undefined
    ? exception
    : { ...exception, value: redactEmails(exception.value) };
}

function scrubLogEntry(logentry: LogEntry): LogEntry {
  return {
    ...(logentry.message === undefined ? {} : { message: redactEmails(logentry.message) }),
    ...(logentry.params === undefined
      ? {}
      : { params: logentry.params.map(param => scrubValue(param, 1)) }),
  };
}

function scrubUser(user: User): User {
  return user.id === undefined ? {} : { id: user.id };
}

function scrubbedText(event: ErrorEvent): EventPatch {
  const values = event.exception?.values;
  return {
    ...(event.message === undefined ? {} : { message: redactEmails(event.message) }),
    ...(event.logentry === undefined ? {} : { logentry: scrubLogEntry(event.logentry) }),
    ...(values === undefined
      ? {}
      : { exception: { ...event.exception, values: values.map(scrubException) } }),
  };
}

function scrubbedPayloads(event: ErrorEvent): EventPatch {
  return {
    ...(event.request === undefined ? {} : { request: scrubRequest(event.request) }),
    ...(event.extra === undefined ? {} : { extra: scrubRecord(event.extra, 1) }),
    ...(event.contexts === undefined
      ? {}
      : { contexts: scrubRecord(event.contexts, 1) as Contexts }),
    ...(event.breadcrumbs === undefined
      ? {}
      : { breadcrumbs: event.breadcrumbs.map(scrubBreadcrumb) }),
    ...(event.user === undefined ? {} : { user: scrubUser(event.user) }),
  };
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  return { ...event, ...scrubbedText(event), ...scrubbedPayloads(event) };
}
