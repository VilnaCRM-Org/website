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
