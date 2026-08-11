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
  /** The version seen in THIS report; informational only, never part of `key`. */
  version: string;
  /** The primary advisory id (first in the group), e.g. `GHSA-hmw2-7cc7-3qxx`. */
  id: string;
  /** Every alias in the group, including `id`, so a reader can search by CVE too. */
  aliases: string[];
  /** CVSS base score as a number; `undefined` when osv-scanner reported none. */
  severity: number | undefined;
}

const UNKNOWN = 'unknown';

/** Parse osv-scanner's string severity into a number, tolerating a missing or junk value. */
function parseSeverity(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
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
      const packageName = entry.package?.name ?? UNKNOWN;
      const ecosystem = entry.package?.ecosystem ?? UNKNOWN;
      const version = entry.package?.version ?? UNKNOWN;

      for (const group of entry.groups ?? []) {
        const ids = group.ids ?? [];
        const id = ids[0];
        if (id === undefined) {
          continue;
        }
        const key = `${ecosystem}|${packageName}|${id}`;
        if (!byKey.has(key)) {
          byKey.set(key, {
            key,
            ecosystem,
            packageName,
            version,
            id,
            aliases: [...new Set([...ids, ...(group.aliases ?? [])])].sort((a, b) =>
              a.localeCompare(b)
            ),
            severity: parseSeverity(group.max_severity),
          });
        }
      }
    }
  }

  return sortFindings([...byKey.values()]);
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
  return `${finding.packageName}@${finding.version} — ${finding.id} (CVSS ${severity}) ${advisory}`;
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

/** One `[[IgnoredVulns]]` entry read out of `osv-scanner.toml`. */
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

/** `key = value` inside an `[[IgnoredVulns]]` block; value is a quoted string or a bare date. */
const ENTRY_FIELD = /^([A-Za-z][A-Za-z0-9_]*)\s*=\s*(?:"([^"]*)"|(\S+))\s*$/;

const IGNORE_HEADER = '[[IgnoredVulns]]';

/**
 * Read the `[[IgnoredVulns]]` entries out of `osv-scanner.toml`.
 *
 * This is a deliberately restricted reader rather than a general TOML parser: the repository
 * has no TOML dependency, and pulling one in to read a file whose format we ourselves control
 * is not worth the supply-chain surface — in a change whose whole point is dependency risk,
 * least of all. It therefore FAILS CLOSED, throwing on any construct it does not recognise,
 * so an entry can never be silently skipped and thereby escape validation. osv-scanner itself
 * rejects unknown keys, so a typo is caught by the scanner as well as here.
 */
export function parseIgnoreEntries(toml: string): IgnoreEntry[] {
  const entries: IgnoreEntry[] = [];
  let current: IgnoreEntry | undefined;

  toml.split('\n').forEach((rawLine, index) => {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (line === '') {
      return;
    }

    if (line === IGNORE_HEADER) {
      current = { line: index + 1 };
      entries.push(current);
      return;
    }

    if (line.startsWith('[')) {
      // Another table (e.g. `[[PackageOverrides]]`) ends the current entry. Its own fields
      // are not this gate's business, so stop collecting rather than misattributing them.
      current = undefined;
      return;
    }

    if (current === undefined) {
      return;
    }

    const field = ENTRY_FIELD.exec(line);
    if (field === null) {
      throw new Error(
        `osv-scanner.toml line ${index + 1}: cannot read "${rawLine.trim()}". ` +
          'Entries must be simple `key = "value"` or `key = value` lines.'
      );
    }

    const [, key, quoted, bare] = field;
    const value = quoted ?? bare ?? '';
    if (key === 'id' || key === 'reason' || key === 'ignoreUntil') {
      current[key] = value;
    }
  });

  return entries;
}

/**
 * Every rule an ignore must satisfy, checked against `today` (an ISO `YYYY-MM-DD` date).
 *
 * This mirrors the memlab leak baseline (#354): an allowance is a dated, justified promise to
 * come back, not a permanent exemption. Comparison is lexicographic, which is exact for
 * zero-padded ISO dates and avoids dragging a timezone into a date-only decision.
 */
export function validateIgnores(entries: readonly IgnoreEntry[], today: string): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const where = `osv-scanner.toml line ${entry.line}`;

    if (entry.id === undefined || entry.id.trim() === '') {
      problems.push(`${where}: [[IgnoredVulns]] entry has no \`id\`.`);
      continue;
    }
    if (seen.has(entry.id)) {
      problems.push(`${where}: duplicate ignore for ${entry.id}.`);
    }
    seen.add(entry.id);

    if (entry.reason === undefined || entry.reason.trim() === '') {
      problems.push(
        `${where}: ignore for ${entry.id} has no \`reason\`. State why it is accepted and ` +
          'what unblocks the fix.'
      );
    }
    if (entry.ignoreUntil === undefined) {
      problems.push(
        `${where}: ignore for ${entry.id} has no \`ignoreUntil\`. Every allowance needs a ` +
          're-triage date.'
      );
    } else if (!ISO_DATE.test(entry.ignoreUntil)) {
      problems.push(
        `${where}: ignore for ${entry.id} has \`ignoreUntil = ${entry.ignoreUntil}\`, which is ` +
          'not a YYYY-MM-DD date.'
      );
    } else if (entry.ignoreUntil < today) {
      problems.push(
        `${where}: ignore for ${entry.id} expired on ${entry.ignoreUntil}. Fix the advisory or ` +
          're-triage it with a new date and reason.'
      );
    }
  }

  return problems;
}
