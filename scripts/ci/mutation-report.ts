/** A single mutant entry in a `mutation-testing-elements` JSON report. */
export interface ReportMutant {
  status?: string;
}

/** A source file entry (the system under test) in a mutation report. */
export interface ReportFile {
  mutants?: ReportMutant[];
}

/** The subset of the `mutation-testing-elements` schema this gate reads. */
export interface MutationReport {
  files?: Record<string, ReportFile>;
}

/** Per-status mutant counts plus the derived detected/undetected/valid totals. */
export interface StatusTally {
  killed: number;
  timeout: number;
  survived: number;
  noCoverage: number;
  compileError: number;
  runtimeError: number;
  ignored: number;
  pending: number;
  detected: number;
  undetected: number;
  valid: number;
}

/** The merged score over a set of shard reports. */
export interface ScoreResult {
  tally: StatusTally;
  fileCount: number;
  mutationScore: number;
}

/** Union the `files` maps of every shard report, keyed by source path (first occurrence wins). */
export function mergeReportFiles(reports: readonly MutationReport[]): Map<string, ReportMutant[]> {
  const byFile = new Map<string, ReportMutant[]>();
  for (const report of reports) {
    for (const [path, file] of Object.entries(report.files ?? {})) {
      if (!byFile.has(path)) {
        byFile.set(path, file?.mutants ?? []);
      }
    }
  }
  return byFile;
}

/** Map each Stryker mutant status to its tally counter. */
const STATUS_TALLY_KEYS = new Map<string, keyof StatusTally>([
  ['Killed', 'killed'],
  ['Timeout', 'timeout'],
  ['Survived', 'survived'],
  ['NoCoverage', 'noCoverage'],
  ['CompileError', 'compileError'],
  ['RuntimeError', 'runtimeError'],
  ['Ignored', 'ignored'],
]);

/** Tally mutant statuses across the merged source files and derive detected/undetected/valid. */
export function tallyMutants(mutantsByFile: ReadonlyMap<string, ReportMutant[]>): StatusTally {
  const tally: StatusTally = {
    killed: 0,
    timeout: 0,
    survived: 0,
    noCoverage: 0,
    compileError: 0,
    runtimeError: 0,
    ignored: 0,
    pending: 0,
    detected: 0,
    undetected: 0,
    valid: 0,
  };

  for (const mutants of mutantsByFile.values()) {
    for (const mutant of mutants) {
      const key = mutant.status === undefined ? undefined : STATUS_TALLY_KEYS.get(mutant.status);
      if (key === undefined) {
        tally.pending += 1;
      } else {
        tally[key] += 1;
      }
    }
  }

  tally.detected = tally.killed + tally.timeout;
  tally.undetected = tally.survived + tally.noCoverage;
  tally.valid = tally.detected + tally.undetected;
  return tally;
}

/** Mutation score (`detected / valid * 100`), or `NaN` when there are no valid mutants. */
export function mutationScore(tally: StatusTally): number {
  return tally.valid > 0 ? (tally.detected / tally.valid) * 100 : Number.NaN;
}

/** A source file that still has mutants no test detected. */
export interface UndetectedFile {
  file: string;
  survived: number;
  noCoverage: number;
}

/**
 * Files with at least one undetected mutant, worst first.
 *
 * The nightly census (#345) reports the whole backlog into one tracking issue,
 * so it needs the per-file breakdown rather than a single aggregate score —
 * "82%" is not actionable, "`helpers/scrollToAnchor.ts`: 6 survived" is.
 */
export function undetectedByFile(
  mutantsByFile: ReadonlyMap<string, ReportMutant[]>
): UndetectedFile[] {
  const rows: UndetectedFile[] = [];
  for (const [file, mutants] of mutantsByFile) {
    const survived = mutants.filter(mutant => mutant.status === 'Survived').length;
    const noCoverage = mutants.filter(mutant => mutant.status === 'NoCoverage').length;
    if (survived + noCoverage > 0) {
      rows.push({ file, survived, noCoverage });
    }
  }
  return rows.sort(
    (a, b) =>
      b.survived + b.noCoverage - (a.survived + a.noCoverage) || a.file.localeCompare(b.file)
  );
}

/**
 * What a census measured: `clean` only when no mutant survived and none ran
 * uncovered. Derived from the same rows `renderSummary` tabulates, so the verdict
 * the tracker script acts on and the Markdown it posts cannot disagree (#513).
 */
export type CensusVerdict = 'clean' | 'findings';

export function censusVerdict(rows: readonly UndetectedFile[]): CensusVerdict {
  const undetected = rows.reduce((total, row) => total + row.survived + row.noCoverage, 0);
  return undetected === 0 ? 'clean' : 'findings';
}

/** Render the Markdown the step summary and the nightly tracking issue both use. */
export function renderSummary(
  scope: string,
  rows: readonly UndetectedFile[],
  score: string
): string {
  const table =
    censusVerdict(rows) === 'clean'
      ? 'No surviving or uncovered mutants. 🎉'
      : [
          '| File | Survived | No coverage |',
          '| --- | ---: | ---: |',
          ...rows.map(row => `| \`${row.file}\` | ${row.survived} | ${row.noCoverage} |`),
        ].join('\n');
  return `### Mutation score (\`${scope}\` scope): ${score}%\n\n${table}\n`;
}

/** Merge shard reports and compute the overall mutation score. */
export function scoreReports(reports: readonly MutationReport[]): ScoreResult {
  const byFile = mergeReportFiles(reports);
  const tally = tallyMutants(byFile);
  return { tally, fileCount: byFile.size, mutationScore: mutationScore(tally) };
}
