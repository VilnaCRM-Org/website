import {
  type MutationReport,
  censusVerdict,
  mergeReportFiles,
  mutationScore,
  renderSummary,
  scoreReports,
  tallyMutants,
  undetectedByFile,
} from '../../../scripts/ci/mutation-report';

function report(files: Record<string, string[]>): MutationReport {
  return {
    files: Object.fromEntries(
      Object.entries(files).map(([path, statuses]) => [
        path,
        { mutants: statuses.map(status => ({ status })) },
      ])
    ),
  };
}

describe('mutation-report merge gate', () => {
  describe('mutationScore mirrors Stryker (detected / valid * 100)', () => {
    it('counts killed and timeout as detected', () => {
      const tally = tallyMutants(mergeReportFiles([report({ 'a.ts': ['Killed', 'Timeout'] })]));
      expect(tally.detected).toBe(2);
      expect(tally.valid).toBe(2);
      expect(mutationScore(tally)).toBe(100);
    });

    it('counts survived and noCoverage against the score (undetected, still valid)', () => {
      const tally = tallyMutants(
        mergeReportFiles([report({ 'a.ts': ['Killed', 'Killed', 'Survived', 'NoCoverage'] })])
      );
      expect(tally.detected).toBe(2);
      expect(tally.undetected).toBe(2);
      expect(tally.valid).toBe(4);
      expect(mutationScore(tally)).toBe(50);
    });

    it('excludes compile/runtime errors and ignored mutants from valid', () => {
      const tally = tallyMutants(
        mergeReportFiles([
          report({ 'a.ts': ['Killed', 'CompileError', 'RuntimeError', 'Ignored'] }),
        ])
      );
      expect(tally.compileError).toBe(1);
      expect(tally.runtimeError).toBe(1);
      expect(tally.ignored).toBe(1);
      expect(tally.valid).toBe(1);
      expect(mutationScore(tally)).toBe(100);
    });

    it('treats Pending and unknown statuses as non-valid', () => {
      const tally = tallyMutants(
        mergeReportFiles([report({ 'a.ts': ['Killed', 'Pending', 'Weird'] })])
      );
      expect(tally.pending).toBe(2);
      expect(tally.valid).toBe(1);
    });

    it('returns NaN when there are no valid mutants', () => {
      const tally = tallyMutants(mergeReportFiles([report({ 'a.ts': ['Ignored'] })]));
      expect(tally.valid).toBe(0);
      expect(Number.isNaN(mutationScore(tally))).toBe(true);
    });
  });

  describe('the break boundary is exact', () => {
    it('scores 80% when 8 of 10 valid mutants are detected', () => {
      const statuses = [...Array(8).fill('Killed'), 'Survived', 'NoCoverage'];
      expect(scoreReports([report({ 'a.ts': statuses })]).mutationScore).toBe(80);
    });

    it('scores below 100% when a single mutant survives (the website break gate)', () => {
      const statuses = [...Array(9).fill('Killed'), 'Survived'];
      expect(scoreReports([report({ 'a.ts': statuses })]).mutationScore).toBeCloseTo(90, 10);
    });
  });

  describe('merging shard reports', () => {
    it('unions disjoint files and sums their mutants', () => {
      const result = scoreReports([
        report({ 'a.ts': ['Killed', 'Killed'] }),
        report({ 'b.ts': ['Killed', 'Survived'] }),
      ]);
      expect(result.fileCount).toBe(2);
      expect(result.tally.detected).toBe(3);
      expect(result.tally.valid).toBe(4);
      expect(result.mutationScore).toBe(75);
    });

    it('does not double-count a file that appears in two shards', () => {
      const duplicate = report({ 'a.ts': ['Killed', 'Survived'] });
      const result = scoreReports([duplicate, duplicate]);
      expect(result.fileCount).toBe(1);
      expect(result.tally.valid).toBe(2);
      expect(result.mutationScore).toBe(50);
    });

    it('tolerates shards whose slice matched no source files', () => {
      const result = scoreReports([{}, report({ 'a.ts': ['Killed'] })]);
      expect(result.fileCount).toBe(1);
      expect(result.mutationScore).toBe(100);
    });
  });

  describe('undetectedByFile drives the nightly census breakdown', () => {
    it('lists only files with undetected mutants, worst first', () => {
      const rows = undetectedByFile(
        mergeReportFiles([
          report({
            'clean.ts': ['Killed', 'Killed'],
            'weak.ts': ['Killed', 'Survived'],
            'weakest.ts': ['Survived', 'Survived', 'NoCoverage'],
          }),
        ])
      );
      expect(rows).toEqual([
        { file: 'weakest.ts', survived: 2, noCoverage: 1 },
        { file: 'weak.ts', survived: 1, noCoverage: 0 },
      ]);
    });

    it('breaks ties on the file path so the census issue is stable between runs', () => {
      const rows = undetectedByFile(
        mergeReportFiles([report({ 'b.ts': ['Survived'], 'a.ts': ['NoCoverage'] })])
      );
      expect(rows.map(row => row.file)).toEqual(['a.ts', 'b.ts']);
    });

    it('ignores statuses that are not undetected', () => {
      const rows = undetectedByFile(
        mergeReportFiles([
          report({ 'a.ts': ['CompileError', 'RuntimeError', 'Ignored', 'Timeout'] }),
        ])
      );
      expect(rows).toEqual([]);
    });

    it('returns an empty list for a report with no files', () => {
      expect(undetectedByFile(mergeReportFiles([{}]))).toEqual([]);
    });
  });

  describe('the census verdict and summary read the same undetected rows', () => {
    const rowsOf = (files: Record<string, string[]>): ReturnType<typeof undetectedByFile> =>
      undetectedByFile(mergeReportFiles([report(files)]));

    it('reads clean when every valid mutant was detected', () => {
      const rows = rowsOf({ 'a.ts': ['Killed', 'Timeout', 'Ignored', 'CompileError'] });
      expect(censusVerdict(rows)).toBe('clean');
      expect(renderSummary('full', rows, '100.00')).toBe(
        '### Mutation score (`full` scope): 100.00%\n\nNo surviving or uncovered mutants. 🎉\n'
      );
    });

    it('reads findings for a single surviving mutant', () => {
      const rows = rowsOf({ 'a.ts': ['Killed', 'Survived'] });
      expect(censusVerdict(rows)).toBe('findings');
      expect(renderSummary('full', rows, '50.00')).toBe(
        [
          '### Mutation score (`full` scope): 50.00%',
          '',
          '| File | Survived | No coverage |',
          '| --- | ---: | ---: |',
          '| `a.ts` | 1 | 0 |',
          '',
        ].join('\n')
      );
    });

    it('reads findings for a mutant no test covered, even at a rounded 100% score', () => {
      const rows = rowsOf({ 'a.ts': ['NoCoverage'] });
      expect(censusVerdict(rows)).toBe('findings');
      expect(renderSummary('full', rows, '100.00')).toContain('| `a.ts` | 0 | 1 |');
    });

    it('never calls a row with zero undetected mutants a finding', () => {
      const rows = [{ file: 'a.ts', survived: 0, noCoverage: 0 }];
      expect(censusVerdict(rows)).toBe('clean');
      expect(renderSummary('full', rows, '100.00')).toContain('No surviving or uncovered');
    });

    it('reads clean for a report with no files', () => {
      expect(censusVerdict(rowsOf({}))).toBe('clean');
    });
  });
});
