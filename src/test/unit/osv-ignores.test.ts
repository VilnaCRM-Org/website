import { readFileSync } from 'node:fs';

import {
  findUnappliedIgnores,
  intersectIgnores,
  parseIgnoreEntries,
  renderIgnoreConfig,
  validateIgnores,
} from '../../../scripts/ci/osv-ignores';

describe('osv-scanner ignore policy', () => {
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

    it('rejects an unquoted non-date value the census leg would choke on', () => {
      // The diff leg re-renders the policy with everything quoted, so only the nightly census
      // hands osv-scanner this file verbatim — and TOML allows a bare value only for a date.
      expect(() =>
        parseIgnoreEntries(
          ['[[IgnoredVulns]]', 'id = GHSA-a', 'reason = "why"', 'ignoreUntil = 2026-12-31'].join(
            '\n'
          )
        )
      ).toThrow(/unquoted value GHSA-a/);
    });

    it('still accepts the one bare value TOML allows here, a date', () => {
      const entries = parseIgnoreEntries(
        ['[[IgnoredVulns]]', 'id = "GHSA-a"', 'reason = "why"', 'ignoreUntil = 2026-12-31'].join(
          '\n'
        )
      );

      expect(entries[0].ignoreUntil).toBe('2026-12-31');
    });

    it('rejects a repeated key instead of silently keeping the last one', () => {
      // Keeping the last value would let the rendered policy the diff leg scans disagree with
      // the file the census leg scans, so one ignore could mean two things at once.
      expect(() =>
        parseIgnoreEntries(
          [
            '[[IgnoredVulns]]',
            'id = "GHSA-a"',
            'id = "GHSA-b"',
            'reason = "why"',
            'ignoreUntil = 2026-12-31',
          ].join('\n')
        )
      ).toThrow(/"id" is set more than once/);
    });

    it('rejects an unsupported key rather than dropping it from the entry', () => {
      // The blocking diff scans under the rendered policy, so osv-scanner never sees this file
      // on a pull request — it would exit 127 on the key, but only in the nightly census.
      expect(() =>
        parseIgnoreEntries(
          [
            '[[IgnoredVulns]]',
            'id = "GHSA-a"',
            'reason = "why"',
            'ignoreUntil = 2026-12-31',
            'ecosystem = "npm"',
          ].join('\n')
        )
      ).toThrow(/unsupported key "ecosystem"/);
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

  describe('the effective policy for a blocking scan', () => {
    const entries = (...ids: string[]) =>
      parseIgnoreEntries(
        ids
          .map(id => `[[IgnoredVulns]]\nid = "${id}"\nignoreUntil = 2027-01-01\nreason = "r"`)
          .join('\n')
      );
    const ids = (list: ReturnType<typeof parseIgnoreEntries>) => list.map(entry => entry.id);

    describe('intersectIgnores', () => {
      it('keeps an ignore present on both sides', () => {
        expect(ids(intersectIgnores(entries('GHSA-a'), entries('GHSA-a')))).toEqual(['GHSA-a']);
      });

      it("takes the working tree's metadata for a shared id, not the base ref's", () => {
        // A renewed or shortened ignoreUntil is what the merge will install, so that is the
        // policy the blocking scan has to run under.
        const base = parseIgnoreEntries(
          '[[IgnoredVulns]]\nid = "GHSA-a"\nignoreUntil = 2027-12-31\nreason = "old"'
        );
        const head = parseIgnoreEntries(
          '[[IgnoredVulns]]\nid = "GHSA-a"\nignoreUntil = 2026-09-01\nreason = "shortened"'
        );

        expect(intersectIgnores(base, head)).toEqual([
          { line: 1, id: 'GHSA-a', ignoreUntil: '2026-09-01', reason: 'shortened' },
        ]);
      });

      it('drops an ignore the change ADDS, so it cannot excuse its own new advisory', () => {
        expect(intersectIgnores(entries('GHSA-a'), entries('GHSA-a', 'GHSA-b'))).toHaveLength(1);
        expect(ids(intersectIgnores([], entries('GHSA-b')))).toEqual([]);
      });

      it('drops an ignore the change REMOVES, which stops suppressing on merge', () => {
        // Otherwise a change could delete an ignore and add a dependency it covered, and the
        // scan would still suppress the advisory that goes live the moment it merges.
        expect(ids(intersectIgnores(entries('GHSA-a', 'GHSA-b'), entries('GHSA-a')))).toEqual([
          'GHSA-a',
        ]);
      });

      it('returns nothing when either side is empty', () => {
        expect(intersectIgnores([], entries('GHSA-a'))).toEqual([]);
        expect(intersectIgnores(entries('GHSA-a'), [])).toEqual([]);
        expect(intersectIgnores([], [])).toEqual([]);
      });

      it('ignores entries with no id on either side', () => {
        const noId = parseIgnoreEntries('[[IgnoredVulns]]\nreason = "no id"');
        expect(intersectIgnores(noId, noId)).toEqual([]);
      });
    });

    describe('findUnappliedIgnores', () => {
      it('separates what the change adds from what it removes', () => {
        expect(
          findUnappliedIgnores(entries('GHSA-a', 'GHSA-b'), entries('GHSA-b', 'GHSA-c'))
        ).toEqual({ added: ['GHSA-c'], removed: ['GHSA-a'] });
      });

      it('reports nothing when both sides agree', () => {
        expect(findUnappliedIgnores(entries('GHSA-a'), entries('GHSA-a'))).toEqual({
          added: [],
          removed: [],
        });
      });

      it('sorts each list so the report is stable', () => {
        const { added } = findUnappliedIgnores([], entries('GHSA-c', 'GHSA-a', 'GHSA-b'));
        expect(added).toEqual(['GHSA-a', 'GHSA-b', 'GHSA-c']);
      });
    });

    describe('renderIgnoreConfig', () => {
      it('round-trips through the parser', () => {
        const rendered = renderIgnoreConfig(entries('GHSA-a', 'GHSA-b'));
        expect(ids(parseIgnoreEntries(rendered))).toEqual(['GHSA-a', 'GHSA-b']);
        expect(validateIgnores(parseIgnoreEntries(rendered), '2026-08-11')).toEqual([]);
      });

      it('emits a parseable file for an empty policy', () => {
        const rendered = renderIgnoreConfig([]);
        expect(parseIgnoreEntries(rendered)).toEqual([]);
        expect(rendered).toContain('GENERATED');
      });

      it('escapes a double quote a literal reason may legitimately contain', () => {
        // `reason = 'he said "no"'` is valid TOML in; interpolated raw into a basic string it
        // would come out invalid, and osv-scanner would exit 127 on a perfectly good config.
        const entry = parseIgnoreEntries(
          '[[IgnoredVulns]]\nid = "GHSA-a"\nreason = \'he said "no"\''
        );

        expect(renderIgnoreConfig(entry)).toContain('reason = "he said \\"no\\""');
      });

      it('escapes a backslash so it cannot start an unintended escape', () => {
        const entry = parseIgnoreEntries(
          '[[IgnoredVulns]]\nid = "GHSA-a"\nreason = \'path C:\\\\tmp\''
        );

        expect(renderIgnoreConfig(entry)).toContain('reason = "path C:\\\\\\\\tmp"');
      });

      it('omits keys the entry does not carry', () => {
        const rendered = renderIgnoreConfig(parseIgnoreEntries('[[IgnoredVulns]]\nid = "GHSA-a"'));
        expect(rendered).toContain('id = "GHSA-a"');
        expect(rendered).not.toContain('ignoreUntil');
        expect(rendered).not.toContain('reason');
      });
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
