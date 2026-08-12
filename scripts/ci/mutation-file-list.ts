import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  type MutationScope,
  capFiles,
  loadMutationPolicy,
  parseScope,
  resolveGate,
  selectMutableFiles,
} from './mutation-scope';

/**
 * Resolve the mutate list for `MUTATION_SCOPE` and record the gate decision (#345).
 *
 * Writes two fixed-path artifacts that the rest of the run reads, so the file
 * list Stryker mutates and the threshold the merge gate enforces can never
 * disagree:
 *
 * - `reports/mutation/mutate-list.txt` — the resolved paths, one per line.
 * - `reports/mutation/gate.json`       — the full gate decision.
 */

/** Fixed output paths; never taken from argv so they stay path-injection safe. */
const LIST_PATH = resolve(process.cwd(), 'reports', 'mutation', 'mutate-list.txt');
const GATE_PATH = resolve(process.cwd(), 'reports', 'mutation', 'gate.json');

/** Run a command with a fixed argument vector and return its stdout lines. */
function runLines(command: string, args: readonly string[]): string[] {
  const stdout = execFileSync(command, [...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout.split('\n').filter(line => line.length > 0);
}

/**
 * Reject a base ref Git would read as an option.
 *
 * `execFileSync` passes a fixed argument vector, so there is no shell injection
 * here — but `git diff --something...HEAD` is still parsed as a flag, and the
 * resulting failure looks like a broken gate rather than a bad input.
 */
function assertUsableRef(ref: string): string {
  if (ref.length === 0 || ref.startsWith('-')) {
    throw new Error(`MUTATION_BASE_REF ("${ref}") must be a revision, not an option.`);
  }
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
      stdio: 'ignore',
    });
  } catch {
    throw new Error(`MUTATION_BASE_REF ("${ref}") does not resolve to a commit in this checkout.`);
  }
  return ref;
}

/**
 * Candidate paths for a scope, before the mutable-path filter.
 *
 * `changed` diffs against the merge base (`base...HEAD`) so a busy `main` does
 * not pull unrelated files into a pull request's scope, and drops deletions —
 * a removed file has nothing to mutate.
 */
function candidatePaths(scope: MutationScope, baseRef: string): string[] {
  if (scope === 'changed') {
    return runLines('git', [
      'diff',
      '--name-only',
      '--diff-filter=d',
      `${assertUsableRef(baseRef)}...HEAD`,
    ]);
  }
  return runLines('git', ['ls-files', '--', 'src']);
}

/**
 * True when at least one spec in the runner's test set reaches `file`.
 *
 * Stryker runs with `enableFindRelatedTests`. When Jest resolves no related
 * spec it runs nothing, exits 0, and every mutant in the file is reported
 * SURVIVED — indistinguishable from a genuinely weak test. `api/graphql/apollo.ts`
 * is the live example: its only coverage is in the integration layer, which this
 * runner does not collect, so it would score 0% and redden a pull request that
 * merely touched it. A file this runner cannot measure is dropped and named,
 * never silently scored.
 */
function hasRelatedTests(file: string, scope: MutationScope): boolean {
  try {
    return (
      execFileSync(
        'bun',
        ['x', 'jest', '-c', 'jest.mutation.config.ts', '--findRelatedTests', file, '--listTests'],
        { encoding: 'utf8', env: { ...process.env, MUTATION_SCOPE: scope }, stdio: 'pipe' }
      )
        .split('\n')
        .filter(line => line.trim().endsWith('.ts') || line.trim().endsWith('.tsx')).length > 0
    );
  } catch {
    // A crashed resolution is not evidence of coverage; treat it as unmeasurable
    // so the run reports the file instead of scoring it as fully survived.
    return false;
  }
}

function main(): void {
  const scope = parseScope(process.env.MUTATION_SCOPE);
  if (scope === 'curated') {
    throw new Error(
      'The "curated" scope is declared in stryker.config.mjs; no file list to resolve.'
    );
  }

  const policy = loadMutationPolicy();
  const baseRef = process.env.MUTATION_BASE_REF ?? 'origin/main';
  const candidates = selectMutableFiles(candidatePaths(scope, baseRef), policy.mutableDirectories);

  const measurable = candidates.filter(file => hasRelatedTests(file, scope));
  const unmeasured = candidates.filter(file => !measurable.includes(file));

  const files = capFiles(measurable, scope, policy);
  const decision = resolveGate(scope, measurable.length, policy);

  mkdirSync(dirname(LIST_PATH), { recursive: true });
  writeFileSync(LIST_PATH, files.length > 0 ? `${files.join('\n')}\n` : '', 'utf8');
  writeFileSync(
    GATE_PATH,
    `${JSON.stringify({ ...decision, scope, fileCount: files.length, unmeasured }, null, 2)}\n`,
    'utf8'
  );

  process.stdout.write(
    [
      `mutation scope "${scope}" resolved ${files.length} mutable file(s):`,
      ...files.map(file => `  ${file}`),
      ...(unmeasured.length > 0
        ? [
            `${unmeasured.length} file(s) skipped — no spec in this runner's ` +
              'test set reaches them:',
            ...unmeasured.map(file => `  ${file}`),
          ]
        : []),
      ...(measurable.length > files.length
        ? [`Truncated to the first ${files.length} of ${measurable.length} to bound the run.`]
        : []),
      decision.reason,
      '',
    ].join('\n')
  );
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
