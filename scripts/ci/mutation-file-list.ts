import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  type MutationScope,
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
 * - `reports/mutation/gate.json`       — `{ scope, fileCount, mode, break }`.
 */

/** Fixed output paths; never taken from argv so they stay path-injection safe. */
const LIST_PATH = resolve(process.cwd(), 'reports', 'mutation', 'mutate-list.txt');
const GATE_PATH = resolve(process.cwd(), 'reports', 'mutation', 'gate.json');

/** Run git with a fixed argument vector and return its stdout lines. */
function gitLines(args: readonly string[]): string[] {
  const stdout = execFileSync('git', [...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return stdout.split('\n').filter(line => line.length > 0);
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
    return gitLines(['diff', '--name-only', '--diff-filter=d', `${baseRef}...HEAD`]);
  }
  return gitLines(['ls-files', '--', 'src']);
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
  const files = selectMutableFiles(candidatePaths(scope, baseRef), policy.mutableDirectories);
  const decision = resolveGate(scope, files.length, policy);

  mkdirSync(dirname(LIST_PATH), { recursive: true });
  writeFileSync(LIST_PATH, files.length > 0 ? `${files.join('\n')}\n` : '', 'utf8');
  writeFileSync(
    GATE_PATH,
    `${JSON.stringify({ scope, fileCount: files.length, ...decision }, null, 2)}\n`,
    'utf8'
  );

  process.stdout.write(
    [
      `mutation scope "${scope}" resolved ${files.length} mutable file(s):`,
      ...files.map(file => `  ${file}`),
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
