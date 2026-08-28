/**
 * The ignore policy for the dependency-CVE gate (issue #356): reading
 * `config/osv-scanner.toml` and deciding which of its entries may take effect.
 *
 * Split out of `osv-report.ts`, which owns the advisory reports themselves. The two are
 * genuinely separate concerns — one reads osv-scanner's JSON, the other reads our TOML — and
 * keeping them in one file pushed it over qlty's file-complexity budget.
 */

/** One `[[IgnoredVulns]]` entry read out of `config/osv-scanner.toml`. */
export interface IgnoreEntry {
  /** 1-based line number of the entry's `[[IgnoredVulns]]` header, for error messages. */
  line: number;
  id?: string;
  reason?: string;
  /** The raw `ignoreUntil` value exactly as written, e.g. `2026-10-01`. */
  ignoreUntil?: string;
}

/** A date-only `ignoreUntil` value: TOML local dates are `YYYY-MM-DD`. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether `value` is a real calendar date, not merely `\d{4}-\d{2}-\d{2}`-shaped.
 *
 * The shape alone is not enough: expiry is compared lexicographically, so a typo like
 * `2026-13-45` sorts after every real date and would silently become an allowance that never
 * expires — the one thing the ignoreUntil contract exists to prevent. Round-tripping through
 * `Date.UTC` rejects impossible months and days, and gets leap years right (2026-02-29 rolls
 * over to March 1 and fails the comparison).
 */
function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * `key = value` inside an `[[IgnoredVulns]]` block.
 *
 * TOML allows a basic ("…") string, a literal ('…') string, or a bare value such as a date.
 * All three are accepted and unquoted here: reading `''` as the two-character value `''`
 * would let an EMPTY reason satisfy the "must have a reason" rule, and reading `'GHSA-a'` and
 * `"GHSA-a"` as different strings would defeat duplicate detection.
 */
const ENTRY_FIELD = /^([A-Za-z][A-Za-z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))\s*$/;

/**
 * An `[[IgnoredVulns]]` header, tolerating the whitespace TOML permits inside the brackets.
 *
 * An exact-string match here would be a FAIL-OPEN: osv-scanner honours `[[ IgnoredVulns ]]`,
 * but this reader would take it for an unrelated table, skip the entry, and let an undated or
 * unjustified ignore through unvalidated.
 */
const IGNORE_HEADER = /^\[\[\s*IgnoredVulns\s*\]\]$/;

/** Default config path, used to prefix messages when the caller does not name the file. */
const DEFAULT_CONFIG = 'config/osv-scanner.toml';

/** Any table header at all, so an unsupported one can be rejected loudly rather than skipped. */
const TABLE_HEADER = /^\[/;

/**
 * Strip a trailing `#` comment, leaving any `#` that sits inside a quoted value alone.
 *
 * A naive `replace(/#.*$/, '')` truncates `reason = "… tracked in #391"` mid-value, which the
 * documented template in config/osv-scanner.toml would hit the first time anyone used it —
 * and because this reader fails closed, that would take the whole gate down rather than
 * degrade quietly. Both TOML quote styles are tracked, and the OPENING delimiter is what
 * closes the value, so a `'` inside a "…" string (or vice versa) is ordinary text. Escaped
 * quotes are not part of the accepted subset, so a value containing one falls through to
 * ENTRY_FIELD and is rejected there.
 */
function stripComment(line: string): string {
  let delimiter: string | undefined;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (delimiter === undefined && (char === '"' || char === "'")) {
      delimiter = char;
    } else if (char === delimiter) {
      delimiter = undefined;
    } else if (char === '#' && delimiter === undefined) {
      return line.slice(0, index);
    }
  }
  return line;
}

/**
 * Read the `[[IgnoredVulns]]` entries out of `config/osv-scanner.toml`.
 *
 * This is a deliberately restricted reader rather than a general TOML parser: the repository
 * has no TOML dependency, and pulling one in to read a file whose format we ourselves control
 * is not worth the supply-chain surface — in a change whose whole point is dependency risk,
 * least of all. It therefore FAILS CLOSED, throwing on any construct it does not recognise,
 * so an entry can never be silently skipped and thereby escape validation. osv-scanner rejects
 * unknown keys too (exit 127, verified against 2.5.0), but only in the census, which reads this
 * file directly; the blocking diff scans under the RENDERED policy, so this reader is the only
 * check a pull request gets.
 */
export function parseIgnoreEntries(toml: string, source = DEFAULT_CONFIG): IgnoreEntry[] {
  const entries: IgnoreEntry[] = [];
  let current: IgnoreEntry | undefined;

  toml.split('\n').forEach((rawLine, index) => {
    const line = stripComment(rawLine).trim();
    if (line === '') {
      return;
    }

    if (IGNORE_HEADER.test(line)) {
      current = { line: index + 1 };
      entries.push(current);
      return;
    }

    if (TABLE_HEADER.test(line)) {
      // Every other table is rejected, not skipped. `[[PackageOverrides]]` with `ignore =
      // true` suppresses a package's findings outright — verified against osv-scanner 2.5.0 —
      // and skipping it would let a suppression through with no reason and no expiry, which is
      // exactly what this policy exists to prevent. A near-miss such as `[IgnoredVulns]` is
      // caught by the same rule instead of silently dropping a real entry out of validation.
      throw new Error(
        `${source} line ${index + 1}: unsupported table "${rawLine.trim()}". This ` +
          'repository allows only `[[IgnoredVulns]]`, so that every suppression carries a ' +
          'reason and an expiry date.'
      );
    }

    if (current === undefined) {
      // A key before any `[[IgnoredVulns]]` header is a root-level osv-scanner setting.
      // `LoadConfigs` is one of those, and it makes the scanner pick up further config files,
      // so ignoring root keys here would leave a way to reach suppressions this reader never
      // sees. The policy is one file, one mechanism.
      throw new Error(
        `${source} line ${index + 1}: "${rawLine.trim()}" sits outside any ` +
          '`[[IgnoredVulns]]` entry. Top-level settings are not part of this repository’s ' +
          'ignore policy.'
      );
    }

    const field = ENTRY_FIELD.exec(line);
    if (field === null) {
      throw new Error(
        `${source} line ${index + 1}: cannot read "${rawLine.trim()}". ` +
          'Entries must be simple `key = "value"` or `key = value` lines.'
      );
    }

    const [, key, basic, literal, bare] = field;
    const value = basic ?? literal ?? bare ?? '';
    if (key !== 'id' && key !== 'reason' && key !== 'ignoreUntil') {
      // Rejected, not dropped. The blocking diff hands osv-scanner the RENDERED policy, which
      // by construction carries only these three keys, so the scanner's own unknown-key check
      // never sees this file on a pull request — only the nightly census does. Dropping the key
      // here merges a config the census then cannot parse (exit 127), and would silently WIDEN
      // an entry the day osv-scanner adds a narrowing key to `[[IgnoredVulns]]`.
      throw new Error(
        `${source} line ${index + 1}: unsupported key "${key}". An \`[[IgnoredVulns]]\` entry ` +
          'may carry only `id`, `reason` and `ignoreUntil`.'
      );
    }
    current[key] = value;
  });

  return entries;
}

/** Expiry rules for one `ignoreUntil` value: present, well-formed, and not yet passed. */
function describeExpiryProblems(
  ignoreUntil: string | undefined,
  id: string,
  where: string,
  today: string
): string[] {
  if (ignoreUntil === undefined) {
    return [
      `${where}: ignore for ${id} has no \`ignoreUntil\`. Every allowance needs a ` +
        're-triage date.',
    ];
  }
  if (!isCalendarDate(ignoreUntil)) {
    return [
      `${where}: ignore for ${id} has \`ignoreUntil = ${ignoreUntil}\`, which is not a real ` +
        'YYYY-MM-DD calendar date.',
    ];
  }
  if (ignoreUntil < today) {
    return [
      `${where}: ignore for ${id} expired on ${ignoreUntil}. Fix the advisory or re-triage ` +
        'it with a new date and reason.',
    ];
  }
  return [];
}

/**
 * Every rule one ignore must satisfy, given that it already carries an id.
 *
 * The reason and the expiry are independent, so both are reported in one pass rather than
 * stopping at the first — whoever wrote the entry should see everything to fix at once.
 */
function describeEntryProblems(
  entry: IgnoreEntry,
  id: string,
  where: string,
  today: string
): string[] {
  const problems: string[] = [];

  if (entry.reason === undefined || entry.reason.trim() === '') {
    problems.push(
      `${where}: ignore for ${id} has no \`reason\`. State why it is accepted and what ` +
        'unblocks the fix.'
    );
  }
  problems.push(...describeExpiryProblems(entry.ignoreUntil, id, where, today));

  return problems;
}

/** The trimmed, non-empty advisory ids in a set of entries. */
function idsOf(entries: readonly IgnoreEntry[]): Set<string> {
  return new Set(entries.map(entry => entry.id?.trim()).filter((id): id is string => Boolean(id)));
}

/**
 * The ignores that may take effect on a blocking scan: those present on BOTH sides.
 *
 * Neither one-sided set can be honoured, for opposite reasons:
 *
 * - Only in `head` — an ignore the change ADDS. Honouring it would let one diff add a
 *   vulnerable dependency and the excuse for it at once, and the gate would pass on exactly
 *   the exposure it exists to catch.
 * - Only in `base` — an ignore the change REMOVES. Honouring it would suppress an advisory
 *   that is live the moment this merges, so a change could drop an ignore and add a
 *   dependency covered by it and still read as clean.
 *
 * The intersection is the policy that will actually be in force after the merge, which is the
 * only one worth gating on.
 */
export function intersectIgnores(
  baseEntries: readonly IgnoreEntry[],
  headEntries: readonly IgnoreEntry[]
): IgnoreEntry[] {
  // Membership is decided by the base ref, but the ENTRY returned is the working tree's, so a
  // renewed or shortened `ignoreUntil` — and an edited reason — is what the scan sees. Taking
  // the base entry would gate on metadata the merge is about to replace.
  const agreed = idsOf(baseEntries);
  return headEntries.filter(entry => {
    const id = entry.id?.trim();
    return id !== undefined && agreed.has(id);
  });
}

/**
 * Advisory ids present on exactly one side — the ignores a blocking scan cannot honour.
 *
 * Reported so that a red gate explains itself: without this, an author who just added (or
 * removed) an ignore sees a failure that looks like the entry is simply broken.
 */
export function findUnappliedIgnores(
  baseEntries: readonly IgnoreEntry[],
  headEntries: readonly IgnoreEntry[]
): { added: string[]; removed: string[] } {
  const baseIds = idsOf(baseEntries);
  const headIds = idsOf(headEntries);
  const sorted = (ids: Iterable<string>): string[] => [...ids].sort((a, b) => a.localeCompare(b));
  return {
    added: sorted([...headIds].filter(id => !baseIds.has(id))),
    removed: sorted([...baseIds].filter(id => !headIds.has(id))),
  };
}

/** Escape a value for a TOML basic string. */
function escapeTomlBasic(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Render entries back to TOML for osv-scanner to consume as the effective policy.
 *
 * Only the three governed keys are emitted. String values are escaped rather than
 * interpolated raw: a TOML LITERAL reason may legitimately contain a double quote
 * (`reason = 'he said "no"'`), and emitting that unescaped into a basic string produces
 * invalid TOML, which osv-scanner rejects with exit 127 — failing the gate on a valid config.
 * `ignoreUntil` needs no escaping; it is validated as a bare `YYYY-MM-DD` date.
 */
export function renderIgnoreConfig(entries: readonly IgnoreEntry[]): string {
  const header =
    '# GENERATED — do not edit. The ignores in force for this scan: the entries present in\n' +
    '# BOTH the base ref and the working tree. See scripts/ci/osv-ignores.ts.\n';
  const blocks = entries.map(entry => {
    const lines = ['', '[[IgnoredVulns]]', `id = "${escapeTomlBasic(entry.id?.trim() ?? '')}"`];
    if (entry.ignoreUntil !== undefined) {
      lines.push(`ignoreUntil = ${entry.ignoreUntil}`);
    }
    if (entry.reason !== undefined) {
      lines.push(`reason = "${escapeTomlBasic(entry.reason)}"`);
    }
    return lines.join('\n');
  });
  return `${header}${blocks.join('\n')}\n`;
}

/**
 * Every rule an ignore must satisfy, checked against `today` (an ISO `YYYY-MM-DD` date).
 *
 * This mirrors the memlab leak baseline (#354): an allowance is a dated, justified promise to
 * come back, not a permanent exemption. Comparison is lexicographic, which is exact for
 * zero-padded ISO dates and avoids dragging a timezone into a date-only decision.
 */
export function validateIgnores(
  entries: readonly IgnoreEntry[],
  today: string,
  source = DEFAULT_CONFIG
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const where = `${source} line ${entry.line}`;
    const id = entry.id?.trim() ?? '';

    // An entry with no id cannot be matched to an advisory or deduplicated against one, so
    // that single problem is the whole verdict for it.
    if (id === '') {
      problems.push(`${where}: [[IgnoredVulns]] entry has no \`id\`.`);
    } else {
      if (seen.has(id)) {
        problems.push(`${where}: duplicate ignore for ${id}.`);
      }
      seen.add(id);
      problems.push(...describeEntryProblems(entry, id, where, today));
    }
  }

  return problems;
}
