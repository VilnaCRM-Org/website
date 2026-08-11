import { readFileSync } from 'node:fs';

import {
  assertOsvReport,
  describeFinding,
  findAddedIgnores,
  findIntroduced,
  findResolved,
  flattenFindings,
  parseIgnoreEntries,
  renderFindings,
  sortFindings,
  validateIgnores,
  type OsvReport,
} from '../../../scripts/ci/osv-report';

interface PackageSpec {
  name: string;
  version: string;
  /** Each entry is one advisory group: its ids, then an optional severity. */
  groups: { ids: string[]; severity?: string; aliases?: string[] }[];
  ecosystem?: string;
}

function report(packages: PackageSpec[], sourcePath = '/repo/bun.lock'): OsvReport {
  return {
    results: [
      {
        source: { path: sourcePath, type: 'lockfile' },
        packages: packages.map(spec => ({
          package: {
            name: spec.name,
            version: spec.version,
            ecosystem: spec.ecosystem ?? 'npm',
          },
          // `exactOptionalPropertyTypes` is on, so an absent alias list has to be an absent
          // KEY rather than an explicit `undefined` — which is also what osv-scanner's JSON
          // actually looks like.
          groups: spec.groups.map(group => ({
            ids: group.ids,
            ...(group.aliases === undefined ? {} : { aliases: group.aliases }),
            ...(group.severity === undefined ? {} : { max_severity: group.severity }),
          })),
        })),
      },
    ],
  };
}

const CLEAN: OsvReport = { results: [] };

describe('osv-report dependency CVE gate', () => {
  describe('flattenFindings', () => {
    it('flattens one finding per package and advisory group', () => {
      const findings = flattenFindings(
        report([
          { name: 'axios', version: '1.16.1', groups: [{ ids: ['GHSA-a'], severity: '8.3' }] },
          { name: 'next', version: '16.2.6', groups: [{ ids: ['GHSA-b'], severity: '6.3' }] },
        ])
      );

      expect(findings).toHaveLength(2);
      expect(findings[0]).toMatchObject({
        key: 'npm|axios|GHSA-a',
        packageName: 'axios',
        versions: ['1.16.1'],
        id: 'GHSA-a',
        severity: 8.3,
      });
    });

    it('keeps every alias in the group so a reader can search by CVE', () => {
      const [finding] = flattenFindings(
        report([
          {
            name: 'axios',
            version: '1.16.1',
            groups: [{ ids: ['GHSA-a'], aliases: ['CVE-2026-1', 'GHSA-a'] }],
          },
        ])
      );

      expect(finding?.aliases).toEqual(['CVE-2026-1', 'GHSA-a']);
    });

    it('collapses the same package advisory reported under two scanned sources', () => {
      const duplicated: OsvReport = {
        results: [
          ...(report([{ name: 'qs', version: '6.15.1', groups: [{ ids: ['GHSA-q'] }] }]).results ??
            []),
          ...(report([{ name: 'qs', version: '6.15.1', groups: [{ ids: ['GHSA-q'] }] }], '/other')
            .results ?? []),
        ],
      };

      expect(flattenFindings(duplicated)).toHaveLength(1);
    });

    it('keeps every affected version when one advisory hits a package at several versions', () => {
      const findings = flattenFindings(
        report([
          { name: 'brace-expansion', version: '2.1.1', groups: [{ ids: ['GHSA-3jxr'] }] },
          { name: 'brace-expansion', version: '1.1.15', groups: [{ ids: ['GHSA-3jxr'] }] },
          { name: 'brace-expansion', version: '5.0.6', groups: [{ ids: ['GHSA-3jxr'] }] },
        ])
      );

      expect(findings).toHaveLength(1);
      expect(findings[0]?.versions).toEqual(['1.1.15', '2.1.1', '5.0.6']);
      expect(findings[0] && describeFinding(findings[0])).toContain(
        'brace-expansion@1.1.15, 2.1.1, 5.0.6'
      );
    });

    it('orders findings by descending severity so the worst reads first', () => {
      const findings = flattenFindings(
        report([
          { name: 'low', version: '1.0.0', groups: [{ ids: ['GHSA-low'], severity: '2.5' }] },
          { name: 'high', version: '1.0.0', groups: [{ ids: ['GHSA-high'], severity: '8.7' }] },
        ])
      );

      expect(findings.map(finding => finding.id)).toEqual(['GHSA-high', 'GHSA-low']);
    });

    it('treats a missing or unparseable severity as unrated and sorts it last', () => {
      const findings = flattenFindings(
        report([
          { name: 'junk', version: '1.0.0', groups: [{ ids: ['GHSA-junk'], severity: 'n/a' }] },
          { name: 'none', version: '1.0.0', groups: [{ ids: ['GHSA-none'] }] },
          { name: 'rated', version: '1.0.0', groups: [{ ids: ['GHSA-rated'], severity: '0.1' }] },
        ])
      );

      expect(findings.map(finding => finding.id)).toEqual(['GHSA-rated', 'GHSA-junk', 'GHSA-none']);
      expect(findings[1]?.severity).toBeUndefined();
    });

    it('skips a group with an empty or absent ids list rather than inventing an identity', () => {
      expect(
        flattenFindings(report([{ name: 'weird', version: '1.0.0', groups: [{ ids: [] }] }]))
      ).toHaveLength(0);
      expect(
        flattenFindings({ results: [{ packages: [{ package: { name: 'w' }, groups: [{}] }] }] })
      ).toHaveLength(0);
    });

    it('returns nothing for an empty, absent-results, or absent-packages report', () => {
      expect(flattenFindings(CLEAN)).toEqual([]);
      expect(flattenFindings({})).toEqual([]);
      expect(flattenFindings({ results: [{ source: { path: 'x' } }] })).toEqual([]);
    });

    it('falls back to "unknown" for a package osv-scanner could not name', () => {
      const [finding] = flattenFindings({
        results: [{ packages: [{ groups: [{ ids: ['GHSA-x'] }] }] }],
      });

      expect(finding).toMatchObject({
        key: 'unknown|unknown|GHSA-x',
        packageName: 'unknown',
        versions: ['unknown'],
        ecosystem: 'unknown',
      });
    });
  });

  describe('assertOsvReport', () => {
    it('accepts a clean scan, which still carries an empty results array', () => {
      expect(assertOsvReport({ results: [] }, 'fixture')).toEqual({ results: [] });
    });

    it('accepts a report with findings', () => {
      const value = report([{ name: 'axios', version: '1.16.1', groups: [{ ids: ['GHSA-a'] }] }]);
      expect(assertOsvReport(value, 'fixture')).toBe(value);
    });

    it('rejects valid JSON that is not a report, which would read as zero advisories', () => {
      // `{}` flattens to no findings and is indistinguishable from a clean scan, so a
      // truncated or wrong-tool file would pass the gate vacuously.
      expect(() => assertOsvReport({}, 'fixture')).toThrow(/no top-level "results" array/);
    });

    it('rejects a results value that is not an array', () => {
      expect(() => assertOsvReport({ results: {} }, 'fixture')).toThrow(/results/);
      expect(() => assertOsvReport({ results: null }, 'fixture')).toThrow(/results/);
    });

    it('rejects JSON primitives and null', () => {
      expect(() => assertOsvReport(null, 'fixture')).toThrow(/not an osv-scanner report/);
      expect(() => assertOsvReport([], 'fixture')).toThrow(/not an osv-scanner report/);
      expect(() => assertOsvReport('{}', 'fixture')).toThrow(/not an osv-scanner report/);
      expect(() => assertOsvReport(7, 'fixture')).toThrow(/not an osv-scanner report/);
    });

    it('names the source so the operator knows which report was rejected', () => {
      expect(() => assertOsvReport({}, 'the head report')).toThrow(/^the head report is not/);
    });
  });

  describe('findIntroduced — the blocking verdict', () => {
    it('reports an advisory that only the head lockfile carries', () => {
      const base = report([{ name: 'axios', version: '1.16.1', groups: [{ ids: ['GHSA-a'] }] }]);
      const head = report([
        { name: 'axios', version: '1.16.1', groups: [{ ids: ['GHSA-a'] }] },
        { name: 'lodash', version: '4.17.15', groups: [{ ids: ['GHSA-jf85'] }] },
      ]);

      expect(findIntroduced(base, head).map(finding => finding.id)).toEqual(['GHSA-jf85']);
    });

    it('stays silent on the pre-existing backlog, which is the whole point of the diff', () => {
      const both = report([
        { name: 'axios', version: '1.16.1', groups: [{ ids: ['GHSA-a'], severity: '8.3' }] },
        { name: 'next', version: '16.2.6', groups: [{ ids: ['GHSA-b'], severity: '6.3' }] },
      ]);

      expect(findIntroduced(both, both)).toEqual([]);
    });

    it('does not fire when a bump carries the SAME advisory to a new version', () => {
      const base = report([{ name: 'axios', version: '1.16.1', groups: [{ ids: ['GHSA-a'] }] }]);
      const head = report([{ name: 'axios', version: '1.17.0', groups: [{ ids: ['GHSA-a'] }] }]);

      expect(findIntroduced(base, head)).toEqual([]);
    });

    it('does fire when a bump adds a NEW advisory to a package already flagged', () => {
      const base = report([{ name: 'axios', version: '1.16.1', groups: [{ ids: ['GHSA-a'] }] }]);
      const head = report([
        { name: 'axios', version: '1.17.0', groups: [{ ids: ['GHSA-a'] }, { ids: ['GHSA-c'] }] },
      ]);

      expect(findIntroduced(base, head).map(finding => finding.id)).toEqual(['GHSA-c']);
    });

    it('fires when the same advisory arrives through a different package', () => {
      const base = report([{ name: 'old', version: '1.0.0', groups: [{ ids: ['GHSA-a'] }] }]);
      const head = report([{ name: 'new', version: '1.0.0', groups: [{ ids: ['GHSA-a'] }] }]);

      expect(findIntroduced(base, head).map(finding => finding.packageName)).toEqual(['new']);
    });

    it('distinguishes ecosystems, so npm and Go advisories never alias each other', () => {
      const base = report([{ name: 'shared', version: '1.0.0', groups: [{ ids: ['GHSA-a'] }] }]);
      const head = report([
        { name: 'shared', version: '1.0.0', groups: [{ ids: ['GHSA-a'] }], ecosystem: 'Go' },
      ]);

      expect(findIntroduced(base, head)).toHaveLength(1);
    });

    it('reports every advisory when the base scan found nothing at all', () => {
      const head = report([{ name: 'axios', version: '1.16.1', groups: [{ ids: ['GHSA-a'] }] }]);

      expect(findIntroduced(CLEAN, head)).toHaveLength(1);
    });
  });

  describe('findResolved — the informational counterpart', () => {
    it('reports an advisory the change cleared', () => {
      const base = report([
        { name: 'axios', version: '1.16.1', groups: [{ ids: ['GHSA-a'] }] },
        { name: 'next', version: '16.2.6', groups: [{ ids: ['GHSA-b'] }] },
      ]);
      const head = report([{ name: 'next', version: '16.2.6', groups: [{ ids: ['GHSA-b'] }] }]);

      expect(findResolved(base, head).map(finding => finding.id)).toEqual(['GHSA-a']);
    });

    it('reports nothing when a change only adds exposure', () => {
      const base = CLEAN;
      const head = report([{ name: 'axios', version: '1.16.1', groups: [{ ids: ['GHSA-a'] }] }]);

      expect(findResolved(base, head)).toEqual([]);
    });
  });

  describe('rendering', () => {
    it('describes a finding with its version, id, score, and advisory link', () => {
      const [finding] = flattenFindings(
        report([
          { name: 'axios', version: '1.16.1', groups: [{ ids: ['GHSA-a'], severity: '8.3' }] },
        ])
      );

      expect(finding && describeFinding(finding)).toBe(
        'axios@1.16.1 — GHSA-a (CVSS 8.3) https://osv.dev/vulnerability/GHSA-a'
      );
    });

    it('says "unrated" rather than printing an empty score', () => {
      const [finding] = flattenFindings(
        report([{ name: 'axios', version: '1.16.1', groups: [{ ids: ['GHSA-a'] }] }])
      );

      expect(finding && describeFinding(finding)).toContain('(CVSS unrated)');
    });

    it('renders the empty-state line when there is nothing to report', () => {
      expect(renderFindings([], 'None found.')).toBe('None found.\n');
    });

    it('renders findings as a severity-ordered Markdown list', () => {
      const findings = flattenFindings(
        report([
          { name: 'low', version: '1.0.0', groups: [{ ids: ['GHSA-low'], severity: '1.0' }] },
          { name: 'high', version: '2.0.0', groups: [{ ids: ['GHSA-high'], severity: '9.0' }] },
        ])
      );

      expect(renderFindings(findings, 'unused')).toBe(
        '- high@2.0.0 — GHSA-high (CVSS 9.0) https://osv.dev/vulnerability/GHSA-high\n' +
          '- low@1.0.0 — GHSA-low (CVSS 1.0) https://osv.dev/vulnerability/GHSA-low\n'
      );
    });

    it('does not mutate the caller’s array while sorting', () => {
      const findings = flattenFindings(
        report([{ name: 'a', version: '1.0.0', groups: [{ ids: ['GHSA-a'] }] }])
      );
      const snapshot = [...findings];

      sortFindings(findings);

      expect(findings).toEqual(snapshot);
    });
  });

  describe('parseIgnoreEntries', () => {
    it('reads id, reason, and ignoreUntil out of an entry', () => {
      const entries = parseIgnoreEntries(
        [
          '[[IgnoredVulns]]',
          'id = "GHSA-a"',
          'ignoreUntil = 2026-12-31',
          'reason = "dev-only; no fixed release"',
        ].join('\n')
      );

      expect(entries).toEqual([
        {
          line: 1,
          id: 'GHSA-a',
          ignoreUntil: '2026-12-31',
          reason: 'dev-only; no fixed release',
        },
      ]);
    });

    it('reads several entries and records each header line for error messages', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'id = "GHSA-a"', '', '[[IgnoredVulns]]', 'id = "GHSA-b"'].join('\n')
      );

      expect(entries.map(entry => [entry.id, entry.line])).toEqual([
        ['GHSA-a', 1],
        ['GHSA-b', 4],
      ]);
    });

    it('ignores comments, blank lines, and trailing comments after a value', () => {
      const entries = parseIgnoreEntries(
        ['# a header comment', '', '[[IgnoredVulns]]', 'id = "GHSA-a" # why', ''].join('\n')
      );

      expect(entries).toEqual([{ line: 3, id: 'GHSA-a' }]);
    });

    it('keeps a `#` inside a quoted value — issue references are ordinary text', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'reason = "dev-only via memlab; tracked in #391"'].join('\n')
      );

      expect(entries).toEqual([{ line: 1, reason: 'dev-only via memlab; tracked in #391' }]);
    });

    it('keeps a `#` inside a TOML literal string too, not just a basic one', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', "reason = 'tracked in #391'"].join('\n')
      );

      expect(entries).toEqual([{ line: 1, reason: 'tracked in #391' }]);
    });

    it('treats the opening delimiter as the closing one, so a nested quote is text', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'reason = "upstream\'s fix #12"'].join('\n')
      );

      expect(entries).toEqual([{ line: 1, reason: "upstream's fix #12" }]);
    });

    it('still strips a real comment that follows a value containing a `#`', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'reason = "see #391" # re-triage with the Q4 bump'].join('\n')
      );

      expect(entries).toEqual([{ line: 1, reason: 'see #391' }]);
    });

    it('parses the osv-scanner.toml template shape the repository documents', () => {
      const entries = parseIgnoreEntries(
        [
          '[[IgnoredVulns]]',
          'id = "GHSA-xxxx-xxxx-xxxx"',
          'ignoreUntil = 2026-12-31',
          'reason = "dev-only transitive via <tool>; no fixed release upstream; tracked in #NNN"',
        ].join('\n')
      );

      expect(validateIgnores(entries, '2026-08-11')).toEqual([]);
    });

    it('returns nothing for a config that declares no ignores', () => {
      expect(parseIgnoreEntries('# nothing here\n')).toEqual([]);
      expect(parseIgnoreEntries('')).toEqual([]);
    });

    it('reads a header with the whitespace TOML allows inside the brackets', () => {
      // A fail-open if missed: osv-scanner honours this spelling, so skipping it here would
      // let an undated, unjustified ignore through unvalidated.
      const entries = parseIgnoreEntries(
        ['[[ IgnoredVulns ]]', 'id = "GHSA-a"', 'ignoreUntil = 2026-12-31'].join('\n')
      );

      expect(entries).toEqual([{ line: 1, id: 'GHSA-a', ignoreUntil: '2026-12-31' }]);
      expect(validateIgnores(entries, '2026-08-11')).toEqual([
        expect.stringContaining('no `reason`'),
      ]);
    });

    it('rejects a near-miss ignore header rather than silently skipping the entry', () => {
      expect(() => parseIgnoreEntries(['[IgnoredVulns]', 'id = "GHSA-a"'].join('\n'))).toThrow(
        /unsupported table/
      );
    });

    it('rejects [[PackageOverrides]], which silences findings with no reason or expiry', () => {
      // Verified against osv-scanner 2.5.0: `ignore = true` drops every finding for the named
      // package. Skipping the table here would let that suppression bypass the whole policy.
      expect(() =>
        parseIgnoreEntries(
          ['[[PackageOverrides]]', 'name = "form-data"', 'ignore = true'].join('\n')
        )
      ).toThrow(/only `\[\[IgnoredVulns\]\]`/);
    });

    it('unquotes a TOML literal string so it is not confused with a basic one', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', "id = 'GHSA-a'", "reason = 'why'"].join('\n')
      );

      expect(entries).toEqual([{ line: 1, id: 'GHSA-a', reason: 'why' }]);
    });

    it('treats an empty literal string as empty, so it cannot pass as a reason', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'id = "GHSA-a"', "reason = ''", 'ignoreUntil = 2026-12-31'].join('\n')
      );

      expect(validateIgnores(entries, '2026-08-11')).toEqual([
        expect.stringContaining('no `reason`'),
      ]);
    });

    it('sees quote styles as the same advisory, so duplicates cannot hide behind them', () => {
      const entries = parseIgnoreEntries(
        [
          '[[IgnoredVulns]]',
          'id = "GHSA-a"',
          'reason = "first"',
          'ignoreUntil = 2026-12-31',
          '[[IgnoredVulns]]',
          "id = 'GHSA-a'",
          'reason = "second"',
          'ignoreUntil = 2026-12-31',
        ].join('\n')
      );

      expect(validateIgnores(entries, '2026-08-11')).toEqual([
        expect.stringContaining('duplicate ignore for GHSA-a'),
      ]);
    });

    it('rejects a root-level setting, which could otherwise reach unseen suppressions', () => {
      // `LoadConfigs = true` makes osv-scanner pick up further config files; a reader that
      // shrugged at root keys would never see the ignores those files carry.
      expect(() => parseIgnoreEntries('LoadConfigs = true\n')).toThrow(
        /sits outside any .\[\[IgnoredVulns\]\]. entry/
      );
    });

    it('keeps only the keys the gate governs, so an unrelated key is not stored', () => {
      const entries = parseIgnoreEntries(['[[IgnoredVulns]]', 'ecosystem = "npm"'].join('\n'));

      expect(entries).toEqual([{ line: 1 }]);
    });

    it('fails closed on a line it cannot read rather than skipping the entry', () => {
      expect(() =>
        parseIgnoreEntries(['[[IgnoredVulns]]', 'id = "GHSA-a"', 'ids = ["a", "b"]'].join('\n'))
      ).toThrow(/line 3/);
    });
  });

  describe('validateIgnores', () => {
    const TODAY = '2026-08-11';

    it('accepts a complete, unexpired entry', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'id = "GHSA-a"', 'ignoreUntil = 2026-12-31', 'reason = "why"'].join(
          '\n'
        )
      );

      expect(validateIgnores(entries, TODAY)).toEqual([]);
    });

    it('accepts an entry expiring exactly today — the date is inclusive', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'id = "GHSA-a"', `ignoreUntil = ${TODAY}`, 'reason = "why"'].join('\n')
      );

      expect(validateIgnores(entries, TODAY)).toEqual([]);
    });

    it('rejects an entry whose ignoreUntil has passed', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'id = "GHSA-a"', 'ignoreUntil = 2026-08-10', 'reason = "why"'].join(
          '\n'
        )
      );

      expect(validateIgnores(entries, TODAY)).toEqual([
        expect.stringContaining('expired on 2026-08-10'),
      ]);
    });

    it('rejects an entry with no reason', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'id = "GHSA-a"', 'ignoreUntil = 2026-12-31'].join('\n')
      );

      expect(validateIgnores(entries, TODAY)).toEqual([expect.stringContaining('no `reason`')]);
    });

    it('rejects an entry whose reason is only whitespace', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'id = "GHSA-a"', 'ignoreUntil = 2026-12-31', 'reason = "   "'].join(
          '\n'
        )
      );

      expect(validateIgnores(entries, TODAY)).toEqual([expect.stringContaining('no `reason`')]);
    });

    it('rejects an entry with no ignoreUntil date', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'id = "GHSA-a"', 'reason = "why"'].join('\n')
      );

      expect(validateIgnores(entries, TODAY)).toEqual([
        expect.stringContaining('no `ignoreUntil`'),
      ]);
    });

    it('rejects an ignoreUntil that is not a YYYY-MM-DD date', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'id = "GHSA-a"', 'ignoreUntil = "soon"', 'reason = "why"'].join('\n')
      );

      expect(validateIgnores(entries, TODAY)).toEqual([
        expect.stringContaining('not a real YYYY-MM-DD calendar date'),
      ]);
    });

    it.each(['2026-13-01', '2026-00-10', '2026-02-30', '2027-02-29', '2026-04-31', '2026-01-32'])(
      'rejects %s — a date-shaped typo would sort after every real date and never expire',
      invalid => {
        const entries = parseIgnoreEntries(
          ['[[IgnoredVulns]]', 'id = "GHSA-a"', `ignoreUntil = ${invalid}`, 'reason = "why"'].join(
            '\n'
          )
        );

        expect(validateIgnores(entries, TODAY)).toEqual([
          expect.stringContaining('not a real YYYY-MM-DD calendar date'),
        ]);
      }
    );

    it('accepts a genuine leap day', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'id = "GHSA-a"', 'ignoreUntil = 2028-02-29', 'reason = "why"'].join(
          '\n'
        )
      );

      expect(validateIgnores(entries, TODAY)).toEqual([]);
    });

    it('rejects an entry with no id and does not cascade further errors from it', () => {
      const entries = parseIgnoreEntries(['[[IgnoredVulns]]', 'reason = "why"'].join('\n'));

      expect(validateIgnores(entries, TODAY)).toEqual([expect.stringContaining('has no `id`')]);
    });

    it('rejects a duplicate ignore for the same advisory', () => {
      const entries = parseIgnoreEntries(
        [
          '[[IgnoredVulns]]',
          'id = "GHSA-a"',
          'ignoreUntil = 2026-12-31',
          'reason = "why"',
          '[[IgnoredVulns]]',
          'id = "GHSA-a"',
          'ignoreUntil = 2026-12-31',
          'reason = "why again"',
        ].join('\n')
      );

      expect(validateIgnores(entries, TODAY)).toEqual([
        expect.stringContaining('duplicate ignore for GHSA-a'),
      ]);
    });

    it('reports every problem at once instead of stopping at the first', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'id = "GHSA-a"', '[[IgnoredVulns]]', 'id = "GHSA-b"'].join('\n')
      );

      expect(validateIgnores(entries, TODAY)).toHaveLength(4);
    });

    it('accepts an empty ignore list — the committed default', () => {
      expect(validateIgnores([], TODAY)).toEqual([]);
    });
  });

  describe('findAddedIgnores', () => {
    const entries = (...ids: string[]) =>
      parseIgnoreEntries(ids.map(id => `[[IgnoredVulns]]\nid = "${id}"`).join('\n'));

    it('names the ignores a change adds on top of the base branch', () => {
      expect(findAddedIgnores(entries('GHSA-a'), entries('GHSA-a', 'GHSA-b'))).toEqual(['GHSA-b']);
    });

    it('reports nothing when the change adds no ignore', () => {
      expect(findAddedIgnores(entries('GHSA-a'), entries('GHSA-a'))).toEqual([]);
      expect(findAddedIgnores([], [])).toEqual([]);
    });

    it('reports every ignore when the base branch has no config yet', () => {
      expect(findAddedIgnores([], entries('GHSA-b', 'GHSA-a'))).toEqual(['GHSA-a', 'GHSA-b']);
    });

    it('does not report an ignore the change REMOVES', () => {
      expect(findAddedIgnores(entries('GHSA-a', 'GHSA-b'), entries('GHSA-a'))).toEqual([]);
    });

    it('ignores entries with no id and de-duplicates repeats', () => {
      const head = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'reason = "no id"', '[[IgnoredVulns]]', 'id = "GHSA-b"'].join('\n')
      );

      expect(findAddedIgnores([], [...head, ...head])).toEqual(['GHSA-b']);
    });
  });

  describe('the committed config/osv-scanner.toml', () => {
    // Guards the real file, not a fixture: an entry that lands without a reason or with a
    // stale date would fail the gate for everyone, and this catches it at unit-test time
    // rather than on the next unlucky pull request.
    const config = readFileSync('config/osv-scanner.toml', 'utf8');

    it('is readable by the gate and carries no policy violations', () => {
      expect(
        validateIgnores(parseIgnoreEntries(config), new Date().toISOString().slice(0, 10))
      ).toEqual([]);
    });
  });
});
