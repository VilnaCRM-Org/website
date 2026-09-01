/**
 * Verdict logic for the e2e flake gate (issue #359).
 *
 * `playwright.config.ts` sets `retries: 2` in CI, so a spec that fails and then passes on a
 * retry is reported green and the flake signal is discarded. That is how the WebKit swagger
 * flake in #290 reached the production CodePipeline. This module reads the machine-readable
 * Playwright JSON report and turns it into two verdicts:
 *
 * - **retry-pass** — a test whose reported status is `flaky` passed only because of a retry.
 * - **burn-in** — a spec run under `--repeat-each=N --retries=0` that failed on some, but not
 *   all, repetitions is nondeterministic.
 *
 * Both verdicts block only for specs the pull request actually changed; flakes elsewhere are
 * surfaced as warnings so the pre-existing backlog does not block unrelated work.
 */

/** One attempt at a test. `retry > 0` means this attempt followed a failure. */
export interface ReportResult {
  status?: string;
  retry?: number;
}

/** One test case: a spec in one project, or one `--repeat-each` repetition of it. */
export interface ReportTest {
  projectName?: string;
  status?: string;
  results?: ReportResult[];
}

/** A `test()` declaration, with one entry in `tests` per project and repetition. */
export interface ReportSpec {
  title?: string;
  file?: string;
  tests?: ReportTest[];
}

/** A `describe()` block or spec file; suites nest arbitrarily deep. */
export interface ReportSuite {
  file?: string;
  specs?: ReportSpec[];
  suites?: ReportSuite[];
}

/** The subset of Playwright's JSON report schema this gate reads. */
export interface PlaywrightJsonReport {
  suites?: ReportSuite[];
}

/** A spec flattened out of the suite tree, with its file path resolved. */
export interface FlatSpec {
  file: string;
  title: string;
  tests: ReportTest[];
}

/** A test identified as nondeterministic, with the evidence for it. */
export interface FlakeFinding {
  file: string;
  title: string;
  project: string;
  failures: number;
  runs: number;
}

/** Normalise a report or diff path so the two can be compared. */
export function normalizePath(file: string): string {
  return file.replace(/^\.\//, '');
}

/**
 * Flatten Playwright's nested suite tree into one entry per spec.
 *
 * A spec's `file` is only set on some nodes depending on nesting, so the nearest enclosing
 * suite's file is threaded down as the fallback.
 */
export function flattenSpecs(report: PlaywrightJsonReport): FlatSpec[] {
  const flat: FlatSpec[] = [];

  const walk = (suites: ReportSuite[], inheritedFile: string): void => {
    for (const suite of suites) {
      const file = suite.file ?? inheritedFile;
      for (const spec of suite.specs ?? []) {
        flat.push({
          file: normalizePath(spec.file ?? file),
          title: spec.title ?? '(untitled)',
          tests: spec.tests ?? [],
        });
      }
      walk(suite.suites ?? [], file);
    }
  };

  walk(report.suites ?? [], '');
  return flat;
}

/** Whether a spec file is one of the paths the pull request changed. */
export function isChanged(file: string, changed: readonly string[]): boolean {
  const normalized = normalizePath(file);
  return changed.some(candidate => normalizePath(candidate) === normalized);
}

/** Whether a single attempt counts as a failure (a timeout is a failure, a skip is not). */
export function isFailure(status: string | undefined): boolean {
  return status === 'failed' || status === 'timedOut' || status === 'interrupted';
}

/**
 * Tests that Playwright itself labelled `flaky` — they failed at least once and then passed
 * on a retry, which the run's exit code hides entirely.
 */
export function findRetryPasses(reports: readonly PlaywrightJsonReport[]): FlakeFinding[] {
  const findings: FlakeFinding[] = [];
  for (const report of reports) {
    for (const spec of flattenSpecs(report)) {
      for (const test of spec.tests.filter(candidate => candidate.status === 'flaky')) {
        const results = test.results ?? [];
        findings.push({
          file: spec.file,
          title: spec.title,
          project: test.projectName ?? 'unknown',
          failures: results.filter(result => isFailure(result.status)).length,
          runs: results.length,
        });
      }
    }
  }
  return findings;
}

/**
 * Specs that failed on some repetitions of a `--repeat-each` burn-in but not all.
 *
 * `threshold` implements the audit's single-failure tolerance: one failure in five absorbs a
 * one-off infrastructure blip, two or more is a flake. A spec that fails every repetition is
 * deterministically broken rather than flaky, so it is reported with `failures === runs` and
 * left for the caller to classify.
 */
export function findBurnInFailures(
  reports: readonly PlaywrightJsonReport[],
  threshold: number
): FlakeFinding[] {
  const byKey = new Map<string, FlakeFinding>();

  for (const report of reports) {
    for (const spec of flattenSpecs(report)) {
      for (const test of spec.tests) {
        const project = test.projectName ?? 'unknown';
        const key = JSON.stringify([spec.file, spec.title, project]);
        const finding = byKey.get(key) ?? {
          file: spec.file,
          title: spec.title,
          project,
          failures: 0,
          runs: 0,
        };
        finding.runs += 1;
        if (test.status === 'unexpected') {
          finding.failures += 1;
        }
        byKey.set(key, finding);
      }
    }
  }

  return [...byKey.values()].filter(finding => finding.failures >= threshold);
}

/** Split findings into the blocking set (changed specs) and the advisory set. */
export function partitionByChanged(
  findings: readonly FlakeFinding[],
  changed: readonly string[]
): { blocking: FlakeFinding[]; advisory: FlakeFinding[] } {
  const blocking: FlakeFinding[] = [];
  const advisory: FlakeFinding[] = [];
  for (const finding of findings) {
    if (isChanged(finding.file, changed)) {
      blocking.push(finding);
    } else {
      advisory.push(finding);
    }
  }
  return { blocking, advisory };
}

/** One-line description of a finding, used for annotations and the census issue body. */
export function describeFinding(finding: FlakeFinding): string {
  const attempts = `${finding.failures}/${finding.runs} attempt(s) failed`;
  return `${finding.file} › ${finding.title} [${finding.project}] — ${attempts}`;
}
