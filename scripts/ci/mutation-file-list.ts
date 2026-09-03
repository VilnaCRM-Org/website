import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  type MutationScope,
  capFiles,
  digestFiles,
  hasRelatedTests,
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

/**
 * Candidate paths for this scope, as produced by `make mutation-file-list`.
 *
 * The list is resolved with git on the host and handed over in a file, because
 * the dev image this runs in ships no git (#399) while the related-tests probe
 * below needs the node_modules only the image has. A missing or unreadable file
 * is a hard error: an empty candidate list is indistinguishable from "nothing
 * changed", which would fail the gate open.
 */
function candidatePaths(): string[] {
  const listPath = process.env.MUTATION_CANDIDATES_FILE;
  if (listPath === undefined || listPath.length === 0) {
    throw new Error(
      'MUTATION_CANDIDATES_FILE is not set; run this through `make mutation-file-list`, ' +
        'which resolves the candidate paths with git before invoking the resolver.'
    );
  }
  return readFileSync(resolve(process.cwd(), listPath), 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/** Ask Jest which specs in the current scope's test set reach `file`. */
function listRelatedTests(file: string, scope: MutationScope): string {
  return execFileSync(
    'bun',
    ['x', 'jest', '-c', 'jest.mutation.config.ts', '--findRelatedTests', file, '--listTests'],
    { encoding: 'utf8', env: { ...process.env, MUTATION_SCOPE: scope }, stdio: 'pipe' }
  );
}

function main(): void {
  const scope = parseScope(process.env.MUTATION_SCOPE);
  if (scope === 'curated') {
    throw new Error(
      'The "curated" scope is declared in stryker.config.mjs; no file list to resolve.'
    );
  }

  const policy = loadMutationPolicy();
  const candidates = selectMutableFiles(candidatePaths(), policy.mutableDirectories);

  const measurable = candidates.filter(file =>
    hasRelatedTests(file, candidate => listRelatedTests(candidate, scope))
  );
  const unmeasured = candidates.filter(file => !measurable.includes(file));

  const files = capFiles(measurable, scope, policy);
  const decision = resolveGate(scope, measurable.length, policy);

  mkdirSync(dirname(LIST_PATH), { recursive: true });
  writeFileSync(LIST_PATH, files.length > 0 ? `${files.join('\n')}\n` : '', 'utf8');
  writeFileSync(
    GATE_PATH,
    `${JSON.stringify(
      { ...decision, scope, fileCount: files.length, digest: digestFiles(files), unmeasured },
      null,
      2
    )}\n`,
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
