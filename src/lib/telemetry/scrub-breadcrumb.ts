import type { Breadcrumb } from '@sentry/react';

import { redactEmails, scrubRecord, scrubUrl } from './redact';

type BreadcrumbData = NonNullable<Breadcrumb['data']>;

interface KeptData {
  readonly keys: readonly string[];
  readonly urlKeys: readonly string[];
}

const NETWORK_DATA: KeptData = { keys: ['method', 'status_code', 'url'], urlKeys: ['url'] };

const KEPT_DATA_BY_CATEGORY: ReadonlyMap<string, KeptData> = new Map([
  ['fetch', NETWORK_DATA],
  ['xhr', NETWORK_DATA],
  ['navigation', { keys: ['from', 'to'], urlKeys: ['from', 'to'] }],
  ['console', { keys: ['logger'], urlKeys: [] }],
]);

function keptDataOf(data: BreadcrumbData, kept: KeptData): BreadcrumbData {
  const scrubbed: BreadcrumbData = {};
  for (const key of kept.keys) {
    if (key in data) scrubbed[key] = data[key];
  }
  for (const key of kept.urlKeys) {
    const url = scrubbed[key];
    if (typeof url === 'string') scrubbed[key] = scrubUrl(url);
  }
  return scrubbed;
}

function scrubBreadcrumbData(category: string | undefined, data: BreadcrumbData): BreadcrumbData {
  const kept = KEPT_DATA_BY_CATEGORY.get(category ?? '');
  return kept === undefined ? scrubRecord(data, 1) : keptDataOf(data, kept);
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
