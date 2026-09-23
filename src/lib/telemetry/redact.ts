export const REDACTED_EMAIL = '[email]';

export const TRUNCATED = '[truncated]';

export const REPEATED = '[repeated]';

export const MAX_SCRUB_DEPTH = 8;

export const MAX_SCRUB_BREADTH = 100;

export const MAX_SCRUB_NODES = 1000;

const EMAIL_PATTERN = /[\p{L}\p{N}._%+-]{1,64}@[\p{L}\p{N}-]{1,63}(?:\.[\p{L}\p{N}-]{1,63}){1,8}/gu;

const QUERY_OR_FRAGMENT = /[?#]/u;

const ABSOLUTE_URL = /^https?:\/\//iu;

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

class ScrubWalk {
  private readonly seen = new WeakSet<object>();

  private nodes = 0;

  enter(value: object, depth: number): string | undefined {
    if (this.seen.has(value)) return REPEATED;
    if (depth >= MAX_SCRUB_DEPTH || this.nodes >= MAX_SCRUB_NODES) return TRUNCATED;
    this.seen.add(value);
    this.nodes += 1;
    return undefined;
  }

  scrub(value: unknown, depth: number): unknown {
    if (typeof value === 'string') {
      return ABSOLUTE_URL.test(value) ? scrubUrl(value) : redactEmails(value);
    }
    if (value === null || typeof value !== 'object') return value;
    return (
      this.enter(value, depth) ??
      (Array.isArray(value) ? this.items(value, depth + 1) : this.entries(value, depth + 1))
    );
  }

  entries(record: object, depth: number): Record<string, unknown> {
    const scrubbed: Record<string, unknown> = {};
    const entries = Object.entries(record);
    for (const [key, entry] of entries.slice(0, MAX_SCRUB_BREADTH)) {
      if (!SENSITIVE_KEYS.has(key.toLowerCase())) scrubbed[key] = this.scrub(entry, depth);
    }
    if (entries.length > MAX_SCRUB_BREADTH) scrubbed[TRUNCATED] = TRUNCATED;
    return scrubbed;
  }

  private items(items: readonly unknown[], depth: number): unknown[] {
    const scrubbed = items.slice(0, MAX_SCRUB_BREADTH).map(item => this.scrub(item, depth));
    return items.length > MAX_SCRUB_BREADTH ? [...scrubbed, TRUNCATED] : scrubbed;
  }
}

export function scrubValue(value: unknown, depth: number): unknown {
  return new ScrubWalk().scrub(value, depth);
}

export function scrubRecord(record: object, depth: number): Record<string, unknown> {
  const walk = new ScrubWalk();
  walk.enter(record, 0);
  return walk.entries(record, depth);
}
