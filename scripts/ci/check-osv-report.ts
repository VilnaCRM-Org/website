import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { findUnappliedIgnores, parseIgnoreEntries, validateIgnores } from './osv-ignores';
import {
  assertOsvReport,
  describeFinding,
  findIntroduced,
  findResolved,
  flattenFindings,
  renderFindings,
  type OsvFinding,
  type OsvReport,
} from './osv-report';

/**
 * CLI for the dependency-CVE gate (issue #356). The verdict logic lives in `osv-report.ts`;
 * this file is the IO shell around it.
 *
 * Modes (`OSV_MODE`):
 * - `diff` (default, BLOCKING) — fails when the head lockfile carries an advisory the base
 *   lockfile does not. Reads `OSV_BASE_REPORT` and `OSV_HEAD_REPORT`.
 * - `census` (ADVISORY) — prints every advisory in `OSV_HEAD_REPORT` as Markdown for the
 *   nightly tracking issue, and always exits 0.
 *
 * Both modes validate `osv-scanner.toml` first, so an expired or unjustified ignore fails the
 * gate on its own. That check is the reason it runs in `census` too: the nightly leg is the
 * only thing that looks at the repository when no pull request is open.
 */

const MODES = ['diff', 'census'] as const;

type Mode = (typeof MODES)[number];

/** Ignore policy, under config/ beside metrics-policy.json. See scripts/ci/scan-vulns.sh. */
const IGNORE_CONFIG = process.env.OSV_CONFIG ?? 'config/osv-scanner.toml';

/** Read and validate the mode so a typo fails closed instead of silently gating nothing. */
function resolveMode(): Mode {
  const raw = process.env.OSV_MODE ?? 'diff';
  const mode = MODES.find(candidate => candidate === raw);
  if (mode === undefined) {
    throw new Error(`OSV_MODE must be one of ${MODES.join(', ')}; got "${raw}".`);
  }
  return mode;
}

/**
 * Resolve a report path from the environment, rejecting anything outside the repository so
 * the gate can never be pointed at an arbitrary filesystem path.
 */
function resolveReportPath(variable: string): string {
  const raw = process.env[variable];
  if (raw === undefined || raw.trim() === '') {
    throw new Error(`${variable} must name an osv-scanner JSON report.`);
  }
  const root = process.cwd();
  const path = resolve(root, raw.trim());
  if (relative(root, path).startsWith('..')) {
    throw new Error(`${variable} must stay inside the repository; got "${path}".`);
  }
  return path;
}

/**
 * Parse an osv-scanner JSON report, failing loudly rather than treating unreadable output as
 * "no vulnerabilities" — a scanner that crashed must not pass the gate vacuously.
 */
function loadReport(variable: string): OsvReport {
  const path = resolveReportPath(variable);
  if (!existsSync(path)) {
    throw new Error(
      `${variable} points at "${path}", which does not exist. A missing scan must not pass ` +
        'the dependency-CVE gate vacuously — check that osv-scanner produced its JSON output.'
    );
  }
  const raw = readFileSync(path, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`osv-scanner report "${path}" is not valid JSON: ${String(error)}`);
  }
  return assertOsvReport(parsed, `osv-scanner report "${path}"`);
}

/** Today's date as `YYYY-MM-DD` in UTC, so expiry does not depend on the runner's timezone. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fail the run when an ignore is undated, unjustified, duplicated, or past its expiry. */
function enforceIgnorePolicy(): void {
  // The config is committed and is passed to osv-scanner on every scan, so its absence means
  // the checkout is wrong or the file was removed. Skipping the policy check in that case
  // would quietly drop the one thing standing between an ignore and an unreviewed exemption.
  if (!existsSync(IGNORE_CONFIG)) {
    throw new Error(
      `${IGNORE_CONFIG} is missing. It is a committed part of the dependency-CVE gate; ` +
        'restore it rather than running the gate without its ignore policy.'
    );
  }
  const problems = validateIgnores(
    parseIgnoreEntries(readFileSync(IGNORE_CONFIG, 'utf8'), IGNORE_CONFIG),
    today(),
    IGNORE_CONFIG
  );
  if (problems.length === 0) {
    return;
  }
  for (const problem of problems) {
    process.stderr.write(`::error file=${IGNORE_CONFIG}::${problem}\n`);
  }
  throw new Error(
    `${problems.length} problem(s) in ${IGNORE_CONFIG}. Every ignore needs an id, a reason, ` +
      'and an unexpired ignoreUntil date.'
  );
}

/**
 * Emit a GitHub Actions annotation; harmless plain text off CI.
 *
 * Annotations go to stderr so they reach the runner (which parses workflow commands on both
 * streams) without landing in stdout — stdout is teed into the job summary and, for the
 * census, verbatim into a GitHub issue body, where a `::warning::` echo of every finding
 * would double the length of the report for no benefit. This matches how
 * `enforceIgnorePolicy` already emits its own annotation.
 */
function annotate(level: 'warning' | 'error', finding: OsvFinding): void {
  process.stderr.write(`::${level}::${describeFinding(finding)}\n`);
}

/**
 * Write Markdown to stdout. The workflow tees stdout into the job summary and, for the
 * census, verbatim into the tracking issue — so nothing but the report belongs on it.
 */
function summarise(markdown: string): void {
  process.stdout.write(markdown);
}

/**
 * Ignores the blocking scan could not honour, and why.
 *
 * scan-vulns.sh scans under the intersection of the base ref's ignores and the working
 * tree's — the policy in force after the merge. When an author has just added or removed an
 * entry, the gate has to say so, or the failure looks like the entry is simply broken.
 */
function reportUnappliedIgnores(): void {
  const basePath = process.env.OSV_BASE_CONFIG;
  if (basePath === undefined || basePath.trim() === '' || !existsSync(basePath)) {
    return;
  }
  const { added, removed } = findUnappliedIgnores(
    parseIgnoreEntries(readFileSync(basePath, 'utf8'), basePath),
    parseIgnoreEntries(readFileSync(IGNORE_CONFIG, 'utf8'), IGNORE_CONFIG)
  );
  if (added.length > 0) {
    summarise(
      `\n> This pull request ADDS ${added.length} ignore(s) — ${added.join(', ')} — which ` +
        'the scan above did not apply. An ignore takes effect only once it is merged, so a ' +
        'change cannot suppress an advisory it introduces in the same diff.\n'
    );
  }
  if (removed.length > 0) {
    summarise(
      `\n> This pull request REMOVES ${removed.length} ignore(s) — ${removed.join(', ')} — ` +
        'so the scan above did not apply them either. They stop suppressing anything the ' +
        'moment this merges, and the gate reflects that now.\n'
    );
  }
}

/** Compare the two scans and fail when the pull request adds exposure. */
function diff(): number {
  const base = loadReport('OSV_BASE_REPORT');
  const head = loadReport('OSV_HEAD_REPORT');

  const introduced = findIntroduced(base, head);
  const resolved = findResolved(base, head);

  summarise(`## Dependency CVE gate\n\n`);
  summarise(`### Introduced by this pull request\n\n`);
  summarise(renderFindings(introduced, 'None — this pull request adds no known advisories.'));
  if (resolved.length > 0) {
    summarise(`\n### Resolved by this pull request\n\n`);
    summarise(renderFindings(resolved, ''));
  }

  reportUnappliedIgnores();

  for (const finding of introduced) {
    annotate('error', finding);
  }

  process.stdout.write(
    `\ndiff: ${introduced.length} advisory/advisories introduced, ` +
      `${resolved.length} resolved, ${flattenFindings(head).length} total in the tree.\n`
  );

  if (introduced.length > 0) {
    process.stderr.write(
      'Dependency CVE gate failed: this pull request adds a dependency with a published ' +
        'advisory. Upgrade to a fixed version, or record a dated, justified ignore in ' +
        `${IGNORE_CONFIG} if the advisory genuinely does not apply.\n`
    );
    return 1;
  }
  return 0;
}

/**
 * Print the whole advisory backlog as Markdown for the nightly tracking issue.
 *
 * Advisory by design: the backlog is known debt and OSV publishes new advisories against
 * unchanged code every week, so a red nightly would page somebody for something no pull
 * request caused. It records what it finds and stays green.
 */
function census(): void {
  const findings = flattenFindings(loadReport('OSV_HEAD_REPORT'));

  summarise(`Known advisories in the dependency tree: **${findings.length}**\n\n`);
  summarise(renderFindings(findings, 'None — the dependency tree is currently clean.'));
  summarise(
    '\nThis census is advisory. The blocking leg runs on every pull request and fails only ' +
      'on advisories that pull request introduces.\n'
  );

  for (const finding of findings) {
    annotate('warning', finding);
  }
}

function main(): void {
  const mode = resolveMode();
  enforceIgnorePolicy();

  if (mode === 'diff') {
    process.exitCode = diff();
    return;
  }
  census();
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
