import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import {
  describeFinding,
  findBurnInFailures,
  findRetryPasses,
  partitionByChanged,
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
  const root = process.cwd();
  const dir = resolve(root, process.env.FLAKE_REPORT_DIR ?? 'test-results');
  const rel = relative(root, dir);
  if (rel.startsWith('..')) {
    throw new Error(`FLAKE_REPORT_DIR must stay inside the repository; got "${dir}".`);
  }
  return dir;
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

function main(): void {
  const mode = resolveMode();
  const dir = resolveReportDir();
  const files = findReportFiles(dir);

  if (files.length === 0) {
    // The two blocking modes fail closed: a missing report must never pass a gate vacuously.
    // The census is a measurement rather than a gate, so it reports the gap and stays green
    // — otherwise a burn-in that times out would page somebody nightly over missing data.
    if (mode === 'census') {
      process.stdout.write(
        `No Playwright ${REPORT_FILE} found under "${dir}", so this census measured nothing. ` +
          'The burn-in run probably failed or timed out; see the job log.\n'
      );
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

  census([...findRetryPasses(reports), ...findBurnInFailures(reports, resolveThreshold())]);
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
