/**
 * Verdict logic for the dependency-CVE gate (issue #356).
 *
 * Nothing in this repository has scanned the dependency tree since Snyk was removed in 2023,
 * so a pull request could add a package with a published advisory and every one of the ~25 PR
 * checks would stay green. This module turns two `osv-scanner --format=json` reports into the
 * two verdicts the gate needs:
 *
 * - **diff** — advisories the pull request INTRODUCES, i.e. present in the head lockfile and
 *   absent from the base lockfile.
 * - **census** — everything currently known about a single lockfile, for the nightly
 *   tracking issue.
 *
 * The pull-request leg is deliberately differential rather than absolute. The tree carries a
 * large pre-existing advisory backlog and OSV publishes new advisories against code nobody
 * touched, so an absolute gate would be red on day one and would keep going red on unrelated
 * pull requests until somebody hand-edited an ignore file. That failure mode is worse than no
 * gate at all: it trains reviewers to click past a security check. Comparing head against base
 * cannot fire on an advisory that already exists on the base branch, so the only way to turn
 * this gate red is to actually add exposure.
 *
 * Findings are keyed by ecosystem + package + advisory id, deliberately WITHOUT the version.
 * Bumping a package to a version that still carries the same advisory is not new exposure and
 * must not block the bump; adding a package, or moving to a version that carries an ADDITIONAL
 * advisory id, is new exposure and does block.
 */

/** The identity of a vulnerable package, as osv-scanner reports it. */
export interface OsvPackage {
  name?: string;
  version?: string;
  ecosystem?: string;
}

/**
 * One cluster of aliased advisories affecting a package. osv-scanner groups aliases (a GHSA
 * and its CVE) so a single issue is not counted twice.
 */
export interface OsvGroup {
  ids?: string[];
  aliases?: string[];
  max_severity?: string;
}

/** One vulnerable package within a scanned source. */
export interface OsvPackageResult {
  package?: OsvPackage;
  groups?: OsvGroup[];
}

/** One scanned source (a lockfile, an SBOM, a directory). */
export interface OsvResult {
  source?: { path?: string; type?: string };
  packages?: OsvPackageResult[];
}

/** The subset of the osv-scanner JSON schema this gate reads. */
export interface OsvReport {
  results?: OsvResult[];
}

/** A single advisory against a single package, flattened out of the report tree. */
export interface OsvFinding {
  /** Stable identity across base and head: ecosystem, package name and advisory id. */
  key: string;
  ecosystem: string;
  packageName: string;
  /**
   * Every vulnerable version of this package seen in THIS report, sorted. Informational only
   * — never part of `key`. A lockfile routinely carries the same package at two or three
   * versions (brace-expansion at 1.x, 2.x and 5.x all carry GHSA-3jxr-9vmj-r5cp), and naming
   * only one of them would send a reader hunting the wrong dependency.
   */
  versions: string[];
  /** The primary advisory id (first in the group), e.g. `GHSA-hmw2-7cc7-3qxx`. */
  id: string;
  /** Every alias in the group, including `id`, so a reader can search by CVE too. */
  aliases: string[];
  /** CVSS base score as a number; `undefined` when osv-scanner reported none. */
  severity: number | undefined;
}

const UNKNOWN = 'unknown';

/**
 * Narrow parsed JSON to an osv-scanner report, rejecting anything that merely parses.
 *
 * `{}` is valid JSON and would flatten to zero findings — indistinguishable from a clean
 * scan, so a truncated or wrong-tool file could pass the gate vacuously. A real report always
 * carries `results`, even when nothing is wrong: a clean scan emits `{"results": []}`
 * (verified against osv-scanner 2.5.0), so requiring the key separates "scanned, found
 * nothing" from "this is not a scan".
 */
export function assertOsvReport(value: unknown, source: string): OsvReport {
  const results: unknown = (value as { results?: unknown } | null)?.results;
  if (typeof value !== 'object' || value === null || !Array.isArray(results)) {
    throw new Error(
      `${source} is not an osv-scanner report: no top-level "results" array. A clean scan ` +
        'still emits {"results": []}, so this file did not come from a completed scan and ' +
        'must not be read as "no advisories".'
    );
  }
  return value as OsvReport;
}

/** Parse osv-scanner's string severity into a number, tolerating a missing or junk value. */
function parseSeverity(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Order findings by descending severity, then by package and id, so output is stable. */
export function sortFindings(findings: readonly OsvFinding[]): OsvFinding[] {
  return [...findings].sort(
    (a, b) =>
      (b.severity ?? -1) - (a.severity ?? -1) ||
      a.packageName.localeCompare(b.packageName) ||
      a.id.localeCompare(b.id)
  );
}

/** Build the finding for one advisory group, or `undefined` when the group carries no id. */
function toFinding(entry: OsvPackageResult, group: OsvGroup): OsvFinding | undefined {
  const ids = group.ids ?? [];
  const id = ids[0];
  if (id === undefined) {
    return undefined;
  }

  const packageName = entry.package?.name ?? UNKNOWN;
  const ecosystem = entry.package?.ecosystem ?? UNKNOWN;

  return {
    key: `${ecosystem}|${packageName}|${id}`,
    ecosystem,
    packageName,
    versions: [entry.package?.version ?? UNKNOWN],
    id,
    aliases: [...new Set([...ids, ...(group.aliases ?? [])])].sort((a, b) => a.localeCompare(b)),
    severity: parseSeverity(group.max_severity),
  };
}

/**
 * Record a finding under its key, folding a repeat occurrence into the versions already seen.
 *
 * The same advisory legitimately hits several resolved versions of one package, and it can
 * also arrive twice through two scanned sources. Both collapse to a single finding so the
 * diff never double-reports, but every affected version is kept for the reader.
 */
function mergeFinding(byKey: Map<string, OsvFinding>, finding: OsvFinding): void {
  const existing = byKey.get(finding.key);
  if (existing === undefined) {
    byKey.set(finding.key, finding);
    return;
  }
  existing.versions = [...new Set([...existing.versions, ...finding.versions])].sort((a, b) =>
    a.localeCompare(b)
  );
}

/**
 * Flatten an osv-scanner report into one entry per package + advisory group.
 *
 * A package can appear under more than one scanned source (the same transitive dependency
 * reached through two lockfiles); the shared `key` collapses those into one finding so the
 * diff does not report a duplicate.
 */
export function flattenFindings(report: OsvReport): OsvFinding[] {
  const byKey = new Map<string, OsvFinding>();

  for (const result of report.results ?? []) {
    for (const entry of result.packages ?? []) {
      for (const group of entry.groups ?? []) {
        const finding = toFinding(entry, group);
        if (finding !== undefined) {
          mergeFinding(byKey, finding);
        }
      }
    }
  }

  return sortFindings([...byKey.values()]);
}

/**
 * Advisories present in `head` and absent from `base` — the exposure this pull request adds.
 *
 * Anything already on the base branch is out of scope by design; it is the nightly census's
 * job to keep the backlog visible.
 */
export function findIntroduced(base: OsvReport, head: OsvReport): OsvFinding[] {
  const known = new Set(flattenFindings(base).map(finding => finding.key));
  return flattenFindings(head).filter(finding => !known.has(finding.key));
}

/**
 * Advisories present in `base` and absent from `head` — exposure this pull request removes.
 *
 * Purely informational: a dependency bump that clears advisories deserves to say so in the
 * job summary, and it makes an otherwise silent green run legible.
 */
export function findResolved(base: OsvReport, head: OsvReport): OsvFinding[] {
  const remaining = new Set(flattenFindings(head).map(finding => finding.key));
  return flattenFindings(base).filter(finding => !remaining.has(finding.key));
}

/** One-line description of a finding, used for annotations and issue bodies. */
export function describeFinding(finding: OsvFinding): string {
  const severity = finding.severity === undefined ? 'unrated' : finding.severity.toFixed(1);
  const advisory = `https://osv.dev/vulnerability/${finding.id}`;
  const affected = `${finding.packageName}@${finding.versions.join(', ')}`;
  return `${affected} — ${finding.id} (CVSS ${severity}) ${advisory}`;
}

/** Render findings as a Markdown list, or a single line when there are none. */
export function renderFindings(findings: readonly OsvFinding[], empty: string): string {
  if (findings.length === 0) {
    return `${empty}\n`;
  }
  return `${sortFindings(findings)
    .map(finding => `- ${describeFinding(finding)}`)
    .join('\n')}\n`;
}

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
 * because this reader fails closed, that would take the whole gate down rather than degrade
 * quietly. A `"` toggles quoted state; escaped quotes are not part of the accepted subset, so
 * a value containing one falls through to ENTRY_FIELD and is rejected there.
 */
function stripComment(line: string): string {
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === '#' && !quoted) {
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
 * so an entry can never be silently skipped and thereby escape validation. osv-scanner itself
 * rejects unknown keys, so a typo is caught by the scanner as well as here.
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
    if (key === 'id' || key === 'reason' || key === 'ignoreUntil') {
      current[key] = value;
    }
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
