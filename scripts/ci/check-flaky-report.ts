import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import {
  classifyCensus,
  collectRunErrors,
  countExecutedTests,
  describeFinding,
  findBurnInFailures,
  findRetryPasses,
  partitionByChanged,
  type CensusVerdict,
  type FlakeFinding,
  type PlaywrightJsonReport,
} from './flaky-report';

const REPORT_FILE = 'results.json';

/** Recursion cap for the report walk; the artifact layout is two levels deep at most. */
const MAX_DEPTH = 6;

type Mode = 'retry-pass' | 'burn-in' | 'census';

const MODES: readonly Mode[] = ['retry-pass', 'burn-in', 'census'];

/**
 * Resolve the report directory from the environment, rejecting anything outside the
 * repository so the walk can never be pointed at an arbitrary filesystem path.
 */
function resolveReportDir(): string {
  return resolveInsideRepo('FLAKE_REPORT_DIR', process.env.FLAKE_REPORT_DIR ?? 'test-results');
}

/** Resolve a path setting against the repository root, refusing one that escapes it. */
function resolveInsideRepo(name: string, value: string): string {
  const root = process.cwd();
  const path = resolve(root, value);
  const rel = relative(root, path);
  if (rel.startsWith('..')) {
    throw new Error(`${name} must stay inside the repository; got "${path}".`);
  }
  return path;
}

/**
 * Record the census verdict for the tracking-issue step (#445), when asked to.
 *
 * A file rather than the exit code: the exit code already means "the checker itself
 * failed", and the Markdown on stdout is prose for humans that the issue step must never
 * have to pattern-match.
 */
function writeCensusVerdict(verdict: CensusVerdict): void {
  const target = process.env.FLAKE_CENSUS_VERDICT_FILE ?? '';
  if (target !== '') {
    writeFileSync(resolveInsideRepo('FLAKE_CENSUS_VERDICT_FILE', target), `${verdict}\n`);
  }
}

/** Collect every `results.json` under `dir`; each shard artifact contributes one. */
function findReportFiles(dir: string, depth = 0): string[] {
  if (depth > MAX_DEPTH) {
    return [];
  }
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...findReportFiles(full, depth + 1));
    } else if (entry === REPORT_FILE) {
      files.push(full);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

/** Parse every discovered report, failing loudly rather than skipping malformed JSON. */
function loadReports(files: readonly string[]): PlaywrightJsonReport[] {
  return files.map(file => {
    const raw = readFileSync(file, 'utf8');
    try {
      return JSON.parse(raw) as PlaywrightJsonReport;
    } catch (error) {
      throw new Error(`Playwright report "${file}" is not valid JSON: ${String(error)}`);
    }
  });
}

/** Read the changed-spec allowlist; whitespace-separated so it survives shell round-trips. */
function resolveChangedSpecs(): string[] {
  return (process.env.FLAKE_CHANGED_SPECS ?? '').split(/\s+/).filter(Boolean);
}

/**
 * Read the burn-in failure threshold (`>= threshold` failures is a flake).
 *
 * The whole value is matched before parsing: `Number.parseInt` would read "2.5" and "2oops"
 * as 2, so a typo'd threshold would silently run the gate at the default instead of failing.
 */
function resolveThreshold(): number {
  const raw = process.env.FLAKE_THRESHOLD ?? '2';
  if (!/^\d+$/.test(raw.trim())) {
    throw new Error(`FLAKE_THRESHOLD must be a positive integer; got "${raw}".`);
  }
  const threshold = Number.parseInt(raw.trim(), 10);
  if (threshold < 1) {
    throw new Error(`FLAKE_THRESHOLD must be a positive integer; got "${raw}".`);
  }
  return threshold;
}

/** Read and validate the mode so a typo fails closed instead of silently gating nothing. */
function resolveMode(): Mode {
  const raw = process.env.FLAKE_MODE ?? 'retry-pass';
  const mode = MODES.find(candidate => candidate === raw);
  if (mode === undefined) {
    throw new Error(`FLAKE_MODE must be one of ${MODES.join(', ')}; got "${raw}".`);
  }
  return mode;
}

/** Emit a GitHub Actions annotation; harmless plain text off CI. */
function annotate(level: 'warning' | 'error', finding: FlakeFinding): void {
  process.stdout.write(`::${level} file=${finding.file}::${describeFinding(finding)}\n`);
}

/** Report findings and return the process exit code for the two blocking modes. */
function gate(mode: Mode, findings: readonly FlakeFinding[], changed: readonly string[]): number {
  const { blocking, advisory } = partitionByChanged(findings, changed);

  for (const finding of advisory) {
    annotate('warning', finding);
  }
  for (const finding of blocking) {
    annotate('error', finding);
  }

  process.stdout.write(
    `${mode}: ${blocking.length} blocking finding(s) in changed specs, ` +
      `${advisory.length} pre-existing finding(s) elsewhere.\n`
  );

  if (blocking.length > 0) {
    process.stderr.write(
      `${mode} gate failed: a spec this pull request changed is nondeterministic. ` +
        'Fix the race; never widen the retry budget to hide it.\n'
    );
    return 1;
  }
  return 0;
}

/**
 * Print the advisory census as Markdown for the nightly tracking issue.
 *
 * A test that failed every single repetition is deterministically broken, not
 * nondeterministic, so it is listed separately — calling it flaky would send whoever reads
 * the tracking issue hunting for a race that does not exist.
 */
function census(findings: readonly FlakeFinding[]): void {
  const flaky = findings.filter(finding => finding.failures < finding.runs);
  const broken = findings.filter(finding => finding.failures === finding.runs);

  if (flaky.length === 0) {
    process.stdout.write('No flaky tests detected in this census run.\n');
  } else {
    process.stdout.write(`Detected ${flaky.length} flaky test(s):\n\n`);
    for (const finding of flaky) {
      process.stdout.write(`- ${describeFinding(finding)}\n`);
    }
  }

  if (broken.length > 0) {
    process.stdout.write(
      `\nAlso ${broken.length} test(s) failed every repetition — consistently broken rather ` +
        'than flaky:\n\n'
    );
    for (const finding of broken) {
      process.stdout.write(`- ${describeFinding(finding)}\n`);
    }
  }
}

/**
 * Grade a census and print it. A report in which no test executed measured nothing, and
 * a run-level error means part of the suite was never measured: neither may read as clean,
 * because a clean verdict closes the tracking issue.
 */
function gradeCensus(reports: readonly PlaywrightJsonReport[], dir: string): CensusVerdict {
  const executed = countExecutedTests(reports);
  const runErrors = collectRunErrors(reports);
  const findings = [
    ...findRetryPasses(reports),
    ...findBurnInFailures(reports, resolveThreshold()),
  ];

  if (executed === 0) {
    process.stdout.write(
      `No test executed in the Playwright report(s) under "${dir}", so this census measured ` +
        'nothing. The burn-in run probably failed before any spec ran; see the job log.\n'
    );
  } else {
    process.stdout.write(`Executed ${executed} test run(s).\n`);
    census(findings);
  }

  if (runErrors.length > 0) {
    process.stdout.write(
      `\nThe run reported ${runErrors.length} run-level error(s), so part of the suite may ` +
        'not have been measured:\n\n'
    );
    for (const message of runErrors) {
      process.stdout.write(`- ${message}\n`);
    }
  }

  return classifyCensus(executed, findings, runErrors);
}

function main(): void {
  const mode = resolveMode();
  const dir = resolveReportDir();
  const files = findReportFiles(dir);

  if (files.length === 0) {
    // The two blocking modes fail closed: a missing report must never pass a gate vacuously.
    // The census still exits 0 here so its Markdown reaches the tracking issue, but it
    // records the `unmeasured` verdict: the issue step keeps the tracker open and turns the
    // run red on it, so a missing report can never read as a clean census (#445).
    if (mode === 'census') {
      process.stdout.write(
        `No Playwright ${REPORT_FILE} found under "${dir}", so this census measured nothing. ` +
          'The burn-in run probably failed or timed out; see the job log.\n'
      );
      writeCensusVerdict('unmeasured');
      return;
    }
    throw new Error(
      `No Playwright ${REPORT_FILE} found under "${dir}". A missing report must not pass ` +
        'the flake gate vacuously — check that the e2e run produced its JSON reporter output.'
    );
  }

  const reports = loadReports(files);
  process.stdout.write(`Read ${files.length} Playwright report(s) from "${dir}".\n`);

  if (mode === 'retry-pass') {
    process.exitCode = gate(mode, findRetryPasses(reports), resolveChangedSpecs());
    return;
  }

  if (mode === 'burn-in') {
    const findings = findBurnInFailures(reports, resolveThreshold());
    process.exitCode = gate(mode, findings, resolveChangedSpecs());
    return;
  }

  writeCensusVerdict(gradeCensus(reports, dir));
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
