import type { Breadcrumb } from '@sentry/react';

import { redactEmails, scrubRecord, scrubUrl } from './redact';

type BreadcrumbData = NonNullable<Breadcrumb['data']>;

const NETWORK_CATEGORIES: ReadonlySet<string> = new Set(['fetch', 'xhr']);

const NETWORK_DATA_KEYS: readonly string[] = ['method', 'status_code', 'url'];

function networkDataOf(data: BreadcrumbData): BreadcrumbData {
  const kept: BreadcrumbData = {};
  for (const key of NETWORK_DATA_KEYS) {
    if (key in data) kept[key] = data[key];
  }
  if (typeof kept.url === 'string') kept.url = scrubUrl(kept.url);
  return kept;
}

function scrubBreadcrumbData(category: string | undefined, data: BreadcrumbData): BreadcrumbData {
  return NETWORK_CATEGORIES.has(category ?? '') ? networkDataOf(data) : scrubRecord(data, 1);
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    ...(breadcrumb.message === undefined ? {} : { message: redactEmails(breadcrumb.message) }),
    ...(breadcrumb.data === undefined
      ? {}
      : { data: scrubBreadcrumbData(breadcrumb.category, breadcrumb.data) }),
  };
}
