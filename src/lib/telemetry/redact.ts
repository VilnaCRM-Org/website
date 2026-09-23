export const REDACTED_EMAIL = '[email]';

export const TRUNCATED = '[truncated]';

export const MAX_SCRUB_DEPTH = 8;

const EMAIL_PATTERN = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;

const QUERY_OR_FRAGMENT = /[?#]/u;

const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'variables',
  'input',
  'password',
  'email',
  'initials',
  'body',
  'cookie',
  'cookies',
  'authorization',
  'token',
]);

type EntryScrubber = (value: unknown, depth: number) => unknown;

export function redactEmails(text: string): string {
  return text.replace(EMAIL_PATTERN, REDACTED_EMAIL);
}

export function stripQuery(url: string): string {
  const cut = url.search(QUERY_OR_FRAGMENT);
  return cut === -1 ? url : url.slice(0, cut);
}

export function scrubUrl(url: string): string {
  return redactEmails(stripQuery(url));
}

function scrubEntries(
  record: object,
  depth: number,
  scrubEntry: EntryScrubber
): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (!SENSITIVE_KEYS.has(key.toLowerCase())) scrubbed[key] = scrubEntry(entry, depth);
  }
  return scrubbed;
}

function scrubNested(value: object, depth: number, scrubEntry: EntryScrubber): unknown {
  return Array.isArray(value)
    ? value.map(item => scrubEntry(item, depth))
    : scrubEntries(value, depth, scrubEntry);
}

export function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return redactEmails(value);
  if (value === null || typeof value !== 'object') return value;
  return depth >= MAX_SCRUB_DEPTH ? TRUNCATED : scrubNested(value, depth + 1, scrubValue);
}

export function scrubRecord(record: object, depth: number): Record<string, unknown> {
  return scrubEntries(record, depth, scrubValue);
}
