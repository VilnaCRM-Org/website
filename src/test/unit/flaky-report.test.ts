import {
  describeFinding,
  findBurnInFailures,
  findRetryPasses,
  flattenSpecs,
  isChanged,
  isFailure,
  normalizePath,
  partitionByChanged,
  type PlaywrightJsonReport,
  type ReportTest,
} from '../../../scripts/ci/flaky-report';

/** A Playwright report holding one spec file with the given tests. */
function report(file: string, title: string, tests: ReportTest[]): PlaywrightJsonReport {
  return { suites: [{ file, specs: [{ title, file, tests }] }] };
}

/** `--repeat-each` repetitions of one spec in one project, `pass`/`fail` per repetition. */
function repetitions(project: string, outcomes: readonly ('pass' | 'fail')[]): ReportTest[] {
  return outcomes.map(outcome => ({
    projectName: project,
    status: outcome === 'fail' ? 'unexpected' : 'expected',
    results: [{ status: outcome === 'fail' ? 'failed' : 'passed', retry: 0 }],
  }));
}

describe('e2e flake gate report parsing', () => {
  describe('flattenSpecs', () => {
    it('flattens nested describe blocks and inherits the enclosing file path', () => {
      const nested: PlaywrightJsonReport = {
        suites: [
          {
            file: 'src/test/e2e/a.spec.ts',
            specs: [{ title: 'top level', tests: [] }],
            suites: [{ specs: [{ title: 'nested', tests: [] }] }],
          },
        ],
      };

      expect(flattenSpecs(nested)).toEqual([
        { file: 'src/test/e2e/a.spec.ts', title: 'top level', tests: [] },
        { file: 'src/test/e2e/a.spec.ts', title: 'nested', tests: [] },
      ]);
    });

    it('returns nothing for an empty report rather than throwing', () => {
      expect(flattenSpecs({})).toEqual([]);
      expect(flattenSpecs({ suites: [] })).toEqual([]);
    });

    it('skips a suite that declares no specs', () => {
      expect(flattenSpecs({ suites: [{ file: 'a.spec.ts' }] })).toEqual([]);
    });

    it('falls back to a placeholder title when a spec has none', () => {
      expect(flattenSpecs({ suites: [{ file: 'a.spec.ts', specs: [{}] }] })).toEqual([
        { file: 'a.spec.ts', title: '(untitled)', tests: [] },
      ]);
    });
  });

  describe('normalizePath and isChanged', () => {
    it('treats a "./"-prefixed report path as the same file as the diff path', () => {
      expect(normalizePath('./src/test/e2e/a.spec.ts')).toBe('src/test/e2e/a.spec.ts');
      expect(isChanged('./src/test/e2e/a.spec.ts', ['src/test/e2e/a.spec.ts'])).toBe(true);
    });

    it('does not treat an unrelated spec as changed', () => {
      expect(isChanged('src/test/e2e/a.spec.ts', ['src/test/e2e/b.spec.ts'])).toBe(false);
    });

    it('does not match on a path prefix', () => {
      expect(isChanged('src/test/e2e/a.spec.ts', ['src/test/e2e/a.spec.ts.bak'])).toBe(false);
    });

    it('treats an empty changed list as nothing changed', () => {
      expect(isChanged('src/test/e2e/a.spec.ts', [])).toBe(false);
    });

    // Exact matching is only correct because Playwright reports paths relative to
    // `config.rootDir`, and rootDir here is the repository root (playwright.config.ts sits
    // at the top level), so report paths are byte-identical to `git diff --name-only`
    // output. Verified against a real CI shard report, whose suites carry
    // `file: "src/test/e2e/check-date.spec.ts"` with `rootDir: "/app"`. If the config ever
    // moves into a subdirectory, report paths become testDir-relative and this breaks.
    it('matches the repository-root-relative paths a real report emits', () => {
      const specs = flattenSpecs({
        suites: [
          {
            file: 'src/test/e2e/check-date.spec.ts',
            specs: [{ title: 'Checking the current year', tests: [] }],
          },
        ],
      });

      expect(specs[0]?.file).toBe('src/test/e2e/check-date.spec.ts');
      expect(isChanged(specs[0]?.file ?? '', ['src/test/e2e/check-date.spec.ts'])).toBe(true);
    });
  });

  describe('isFailure', () => {
    it.each(['failed', 'timedOut', 'interrupted'])('counts %s as a failure', status => {
      expect(isFailure(status)).toBe(true);
    });

    it.each(['passed', 'skipped', undefined])('does not count %s as a failure', status => {
      expect(isFailure(status)).toBe(false);
    });
  });

  describe('findRetryPasses', () => {
    it('flags a test Playwright reported as flaky, counting its failed attempts', () => {
      const findings = findRetryPasses([
        report('src/test/e2e/a.spec.ts', 'logs in', [
          {
            projectName: 'webkit',
            status: 'flaky',
            results: [
              { status: 'failed', retry: 0 },
              { status: 'passed', retry: 1 },
            ],
          },
        ]),
      ]);

      expect(findings).toEqual([
        {
          file: 'src/test/e2e/a.spec.ts',
          title: 'logs in',
          project: 'webkit',
          failures: 1,
          runs: 2,
        },
      ]);
    });

    it('ignores clean passes and hard failures', () => {
      const findings = findRetryPasses([
        report('a.spec.ts', 'passes', [{ projectName: 'chromium', status: 'expected' }]),
        report('b.spec.ts', 'breaks', [{ projectName: 'chromium', status: 'unexpected' }]),
      ]);

      expect(findings).toEqual([]);
    });

    it('collects flakes across every shard report', () => {
      const findings = findRetryPasses([
        report('a.spec.ts', 'one', [{ projectName: 'chromium', status: 'flaky', results: [] }]),
        report('b.spec.ts', 'two', [{ projectName: 'firefox', status: 'flaky', results: [] }]),
      ]);

      expect(findings.map(finding => finding.file)).toEqual(['a.spec.ts', 'b.spec.ts']);
    });

    it('reports an unnamed project as unknown instead of dropping the finding', () => {
      const findings = findRetryPasses([report('a.spec.ts', 'one', [{ status: 'flaky' }])]);

      expect(findings).toEqual([
        { file: 'a.spec.ts', title: 'one', project: 'unknown', failures: 0, runs: 0 },
      ]);
    });
  });

  describe('findBurnInFailures', () => {
    it('flags a spec that failed on two of five repetitions', () => {
      const findings = findBurnInFailures(
        [
          report(
            'src/test/e2e/a.spec.ts',
            'races',
            repetitions('chromium', ['pass', 'fail', 'pass', 'fail', 'pass'])
          ),
        ],
        2
      );

      expect(findings).toEqual([
        {
          file: 'src/test/e2e/a.spec.ts',
          title: 'races',
          project: 'chromium',
          failures: 2,
          runs: 5,
        },
      ]);
    });

    it('tolerates a single failure as a one-off infrastructure blip', () => {
      const findings = findBurnInFailures(
        [report('a.spec.ts', 'blips', repetitions('chromium', ['pass', 'fail', 'pass']))],
        2
      );

      expect(findings).toEqual([]);
    });

    it('still reports a spec that failed every repetition', () => {
      const findings = findBurnInFailures(
        [report('a.spec.ts', 'broken', repetitions('chromium', ['fail', 'fail', 'fail']))],
        2
      );

      expect(findings[0]).toMatchObject({ failures: 3, runs: 3 });
    });

    it('keeps projects separate so a WebKit-only flake is not diluted', () => {
      const findings = findBurnInFailures(
        [
          report('a.spec.ts', 'races', [
            ...repetitions('chromium', ['pass', 'pass', 'pass']),
            ...repetitions('webkit', ['fail', 'fail', 'pass']),
          ]),
        ],
        2
      );

      expect(findings).toEqual([
        { file: 'a.spec.ts', title: 'races', project: 'webkit', failures: 2, runs: 3 },
      ]);
    });

    it('accumulates repetitions of the same spec split across shard reports', () => {
      const findings = findBurnInFailures(
        [
          report('a.spec.ts', 'races', repetitions('chromium', ['fail'])),
          report('a.spec.ts', 'races', repetitions('chromium', ['fail', 'pass'])),
        ],
        2
      );

      expect(findings).toEqual([
        { file: 'a.spec.ts', title: 'races', project: 'chromium', failures: 2, runs: 3 },
      ]);
    });

    it('honours a stricter threshold of one', () => {
      const findings = findBurnInFailures(
        [report('a.spec.ts', 'blips', repetitions('chromium', ['pass', 'fail']))],
        1
      );

      expect(findings).toHaveLength(1);
    });

    it('returns nothing when no test ran', () => {
      expect(findBurnInFailures([{}], 2)).toEqual([]);
    });

    it('reports an unnamed project as unknown instead of dropping the repetitions', () => {
      const findings = findBurnInFailures(
        [
          report('a.spec.ts', 'races', [
            { status: 'unexpected' },
            { status: 'unexpected' },
            { status: 'expected' },
          ]),
        ],
        2
      );

      expect(findings).toEqual([
        { file: 'a.spec.ts', title: 'races', project: 'unknown', failures: 2, runs: 3 },
      ]);
    });
  });

  describe('partitionByChanged', () => {
    it('blocks on changed specs and only warns about the pre-existing backlog', () => {
      const findings = findRetryPasses([
        report('src/test/e2e/changed.spec.ts', 'a', [{ status: 'flaky' }]),
        report('src/test/e2e/legacy.spec.ts', 'b', [{ status: 'flaky' }]),
      ]);

      const { blocking, advisory } = partitionByChanged(findings, ['src/test/e2e/changed.spec.ts']);

      expect(blocking.map(finding => finding.file)).toEqual(['src/test/e2e/changed.spec.ts']);
      expect(advisory.map(finding => finding.file)).toEqual(['src/test/e2e/legacy.spec.ts']);
    });

    it('classes every finding as advisory when the diff touched no spec', () => {
      const findings = findRetryPasses([report('a.spec.ts', 'a', [{ status: 'flaky' }])]);

      expect(partitionByChanged(findings, []).blocking).toEqual([]);
      expect(partitionByChanged(findings, []).advisory).toHaveLength(1);
    });
  });

  describe('describeFinding', () => {
    it('names the file, title, project and failure ratio', () => {
      expect(
        describeFinding({
          file: 'a.spec.ts',
          title: 'races',
          project: 'webkit',
          failures: 2,
          runs: 5,
        })
      ).toBe('a.spec.ts › races [webkit] — 2/5 attempt(s) failed');
    });
  });
});
