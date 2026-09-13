/**
 * Gate the two production-source ESLint guards from ADR 0005 (PR #467 review):
 *
 * - `vilnacrm/no-comments` — no comment of any kind in `src/` and `pages/`
 *   production code; rationale lives in docs/, an ADR, the spec that pins the
 *   behaviour, or the commit message.
 * - the `no-restricted-syntax` selectors that refuse an object literal anywhere
 *   inside a `sx` or `style` attribute — styles live in a sibling `styles.ts`.
 *
 * Both are proved by running the real `eslint` binary against the committed
 * `eslint.config.mjs`, never a copy of the rule: a probe is fed through
 * `--stdin` under a `pages/` filename (the one production scope the type-aware
 * parser does not require to exist on disk), and the scope of each rule is read
 * back with `--print-config` for a production path, a page, a spec and a story.
 * The spec therefore fails when a rule is dropped, downgraded, re-scoped, or
 * when a spelling of the banned construct stops being caught — and it proves
 * the negative direction too, so the gate cannot pass vacuously.
 */
import { execFileSync, spawnSync, SpawnSyncReturns } from 'node:child_process';
import path from 'node:path';

const REPO_ROOT: string = path.resolve(__dirname, '../../../..');
const ESLINT_BIN: string = path.join(REPO_ROOT, 'node_modules/eslint/bin/eslint.js');

interface LintMessage {
  ruleId: string | null;
  line: number;
  message: string;
}

interface LintResult {
  messages: LintMessage[];
}

type RuleConfig = [number, ...unknown[]] | undefined;

function lintProbe(source: string): LintMessage[] {
  const run: SpawnSyncReturns<string> = spawnSync(
    process.execPath,
    [ESLINT_BIN, '--stdin', '--stdin-filename', 'pages/probe.tsx', '--format', 'json'],
    { cwd: REPO_ROOT, input: source, encoding: 'utf8' }
  );
  const [result] = JSON.parse(run.stdout) as LintResult[];

  return result!.messages;
}

function ruleConfigFor(file: string, rule: string): RuleConfig {
  const output: string = execFileSync(process.execPath, [ESLINT_BIN, '--print-config', file], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).toString();
  const config: { rules: Record<string, RuleConfig> } = JSON.parse(output);

  return config.rules[rule];
}

function linesReportedBy(messages: LintMessage[], rule: string): number[] {
  return messages.filter(message => message.ruleId === rule).map(message => message.line);
}

describe('production-source gates (ADR 0005)', () => {
  describe('vilnacrm/no-comments', () => {
    it('reports every comment spelling in a production file', () => {
      const source: string = [
        "import { Box } from '@mui/material';", // 1
        "import styles from './styles';", // 2
        '', // 3
        '// a line comment', // 4
        '/* a block comment */', // 5
        '/**', // 6
        ' * a JSDoc block', // 7
        ' */', // 8
        'export default function Probe(): React.ReactElement {', // 9
        '  const value: number = 1; // trailing', // 10
        '  return <Box sx={styles.wrapper}>{/* a JSX comment */}</Box>;', // 11
        '}', // 12
        '',
      ].join('\n');

      const messages: LintMessage[] = lintProbe(source);
      const lines: number[] = linesReportedBy(messages, 'vilnacrm/no-comments');

      expect(lines).toEqual([4, 5, 6, 10, 11]);
      expect(messages.find(message => message.ruleId === 'vilnacrm/no-comments')?.message).toMatch(
        /docs\/adr\/0005/
      );
    });

    it('is silent on a comment-free production file', () => {
      const source: string = [
        "import { Box } from '@mui/material';",
        "import styles from './styles';",
        '',
        'export default function Probe(): React.ReactElement {',
        "  const url: string = 'https://example.com/not-a-comment';",
        '  return <Box sx={styles.wrapper}>{url}</Box>;',
        '}',
        '',
      ].join('\n');

      expect(linesReportedBy(lintProbe(source), 'vilnacrm/no-comments')).toEqual([]);
    });

    it.each(['src/components/probe/index.tsx', 'src/lib/probe.ts', 'pages/probe.tsx'])(
      'is an error for the production path %s',
      file => {
        expect(ruleConfigFor(file, 'vilnacrm/no-comments')).toEqual([2]);
      }
    );

    it.each([
      'src/test/unit/probe.test.ts',
      'src/components/probe/probe.stories.tsx',
      'tests/integration/probe.integration.test.tsx',
    ])('does not apply to the exempt path %s', file => {
      expect(ruleConfigFor(file, 'vilnacrm/no-comments')).toBeUndefined();
    });
  });

  describe('inline styles', () => {
    it('reports an object literal in every position inside sx and style', () => {
      const source: string = [
        "import { Box } from '@mui/material';", // 1
        "import styles from './styles';", // 2
        '', // 3
        'export default function Probe(): React.ReactElement {', // 4
        '  return (', // 5
        '    <>', // 6
        '      <Box sx={{ mt: 1 }} />', // 7
        '      <Box sx={[styles.wrapper, { mt: 1 }]} />', // 8
        '      <Box sx={{ ...styles.wrapper, mt: 1 }} />', // 9
        '      <Box sx={theme => ({ color: theme.palette.primary.main })} />', // 10
        '      <Box style={{ marginTop: 1 }} />', // 11
        '    </>', // 12
        '  );', // 13
        '}', // 14
        '',
      ].join('\n');

      const messages: LintMessage[] = lintProbe(source);

      expect(linesReportedBy(messages, 'no-restricted-syntax')).toEqual([7, 8, 9, 10, 11]);
      expect(messages.filter(message => message.ruleId === 'no-restricted-syntax')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ line: 7, message: expect.stringMatching(/styles\.ts/) }),
          expect.objectContaining({ line: 11, message: expect.stringMatching(/styles\.ts/) }),
        ])
      );
    });

    it('accepts styles referenced from a styles file', () => {
      const source: string = [
        "import { Box } from '@mui/material';",
        "import styles from './styles';",
        '',
        'export default function Probe({ src }: { src: string }): React.ReactElement {',
        '  return (',
        '    <>',
        '      <Box sx={styles.wrapper} />',
        '      <Box sx={[styles.wrapper, styles.title]} />',
        '      <Box sx={styles.vector(src)} />',
        '      <Box style={styles.inline} />',
        '    </>',
        '  );',
        '}',
        '',
      ].join('\n');

      expect(linesReportedBy(lintProbe(source), 'no-restricted-syntax')).toEqual([]);
    });

    it('keeps the selectors in the production scope next to the process.env guard', () => {
      const config: RuleConfig = ruleConfigFor(
        'src/components/probe/index.tsx',
        'no-restricted-syntax'
      );
      const selectors: string[] = (config ?? [])
        .slice(1)
        .map(entry => (entry as { selector: string }).selector);

      expect(config?.[0]).toBe(2);
      expect(selectors).toEqual(
        expect.arrayContaining([
          "JSXAttribute[name.name='sx'] ObjectExpression",
          "JSXAttribute[name.name='style'] ObjectExpression",
          "MemberExpression[object.name='process'][property.name='env']",
        ])
      );
    });
  });
});
