import {
  type MutationReport,
  mergeReportFiles,
  mutationScore,
  scoreReports,
  tallyMutants,
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
});
