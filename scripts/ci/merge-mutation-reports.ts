import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  type MutationReport,
  mergeReportFiles,
  scoreReports,
  undetectedByFile,
} from './mutation-report';
import {
  type GateDecision,
  type MutationScope,
  loadMutationPolicy,
  parseScope,
  resolveGate,
} from './mutation-scope';

const SHARD_FILE = /^mutation-shard-\d+\.json$/;

/** Fixed report directory; never taken from argv so it stays path-injection safe. */
const REPORTS_DIR = resolve(process.cwd(), 'reports', 'mutation');
const GATE_PATH = join(REPORTS_DIR, 'gate.json');
const SUMMARY_PATH = join(REPORTS_DIR, 'summary.md');

/** Read and parse every `mutation-shard-*.json` report in `dir`, sorted by name. */
function loadShardReports(dir: string): { name: string; report: MutationReport }[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch (error) {
    throw new Error(`Could not read mutation report directory "${dir}": ${String(error)}`);
  }

  return entries
    .filter(name => SHARD_FILE.test(name))
    .sort((a, b) => a.localeCompare(b))
    .map(name => {
      const raw = readFileSync(join(dir, name), 'utf8');
      try {
        return { name, report: JSON.parse(raw) as MutationReport };
      } catch (error) {
        throw new Error(`Mutation report "${name}" is not valid JSON: ${String(error)}`);
      }
    });
}

/**
 * The gate this run enforces.
 *
 * The `curated` scope is a fixed list, so its threshold comes straight from the
 * policy. The `changed` and `full` scopes depend on how many files the run
 * actually resolved, so they reuse the decision `mutation-file-list.ts` already
 * recorded — re-deriving it here could disagree with the list that was mutated.
 */
function resolveDecision(scope: MutationScope, fileCount: number): GateDecision {
  const policy = loadMutationPolicy();
  if (scope === 'curated') {
    return resolveGate(scope, fileCount, policy);
  }
  let raw: string;
  try {
    raw = readFileSync(GATE_PATH, 'utf8');
  } catch (error) {
    throw new Error(
      `MUTATION_SCOPE="${scope}" needs the gate decision at "${GATE_PATH}": ${String(error)}`
    );
  }
  const decision = JSON.parse(raw) as Partial<GateDecision>;
  if (decision.mode === undefined || !('break' in decision)) {
    throw new Error(`"${GATE_PATH}" is not a gate decision; refusing to score without one.`);
  }
  return { mode: decision.mode, break: decision.break ?? null, reason: decision.reason ?? '' };
}

/** Verify every expected shard produced a report, so a missing shard cannot pass vacuously. */
function assertShardsComplete(names: readonly string[], expected: number): void {
  if (names.length !== expected) {
    throw new Error(
      `Expected ${expected} shard reports but found ${names.length} (${
        names.join(', ') || 'none'
      }). A missing shard must not pass the gate vacuously.`
    );
  }
  const seen = new Set(names.map(name => Number.parseInt(/\d+/.exec(name)?.[0] ?? '-1', 10)));
  for (let i = 0; i < expected; i += 1) {
    if (!seen.has(i)) {
      throw new Error(`Mutation shard ${i} of ${expected} is missing from "${REPORTS_DIR}".`);
    }
  }
}

/** Render the Markdown the step summary and the nightly tracking issue both use. */
function renderSummary(
  scope: MutationScope,
  reports: readonly MutationReport[],
  score: string
): string {
  const rows = undetectedByFile(mergeReportFiles(reports));
  const table =
    rows.length === 0
      ? 'No surviving or uncovered mutants. 🎉'
      : [
          '| File | Survived | No coverage |',
          '| --- | ---: | ---: |',
          ...rows.map(row => `| \`${row.file}\` | ${row.survived} | ${row.noCoverage} |`),
        ].join('\n');
  return `### Mutation score (\`${scope}\` scope): ${score}%\n\n${table}\n`;
}

/** Merge shard reports, recompute the score, and enforce the scope's gate. */
function main(): void {
  const scope = parseScope(process.env.MUTATION_SCOPE);

  const expectedShards = Number.parseInt(process.env.MUTATION_SHARD_TOTAL ?? '', 10);
  if (!Number.isInteger(expectedShards) || expectedShards <= 0) {
    throw new Error(
      'MUTATION_SHARD_TOTAL must be a positive integer so the gate can verify every shard.'
    );
  }

  const shards = loadShardReports(REPORTS_DIR);
  assertShardsComplete(
    shards.map(shard => shard.name),
    expectedShards
  );

  const reports = shards.map(shard => shard.report);
  const { tally, fileCount, mutationScore } = scoreReports(reports);

  if (!Number.isFinite(mutationScore) || tally.valid === 0) {
    throw new Error(
      `No valid mutants found across ${shards.length} shard(s) over ${fileCount} file(s); ` +
        'the mutation run is misconfigured.'
    );
  }

  const decision = resolveDecision(scope, fileCount);

  const score = mutationScore.toFixed(2);
  writeFileSync(SUMMARY_PATH, renderSummary(scope, reports, score), 'utf8');
  process.stdout.write(
    [
      `Merged ${shards.length} mutation shard(s) over ${fileCount} source file(s):`,
      `  killed=${tally.killed} timeout=${tally.timeout} ` +
        `survived=${tally.survived} noCoverage=${tally.noCoverage}`,
      `  compileError=${tally.compileError} runtimeError=${tally.runtimeError} ` +
        `ignored=${tally.ignored}`,
      `  detected=${tally.detected} valid=${tally.valid} mutationScore=${score}%`,
      decision.reason,
      '',
    ].join('\n')
  );

  if (decision.break === null) {
    process.stdout.write(`Mutation score ${score}% recorded without gating (${decision.mode}).\n`);
    return;
  }

  if (mutationScore < decision.break) {
    process.stderr.write(
      `Mutation score ${score}% is below the break threshold ${decision.break}%. Gate failed.\n`
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `Mutation score ${score}% meets the break threshold ${decision.break}%. Gate passed.\n`
  );
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
