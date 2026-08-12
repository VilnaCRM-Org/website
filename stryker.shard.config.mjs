import { existsSync, readFileSync } from 'node:fs';

import base from './stryker.config.mjs';

const total = Math.max(1, Number.parseInt(process.env.MUTATION_SHARD_TOTAL ?? '1', 10) || 1);
const index = Math.max(0, Number.parseInt(process.env.MUTATION_SHARD_INDEX ?? '0', 10) || 0);
const SCOPES = ['curated', 'changed', 'full'];
const scope = process.env.MUTATION_SCOPE?.trim() || 'curated';

// Reject a typo here rather than at the merge gate. Without this, an unknown
// scope falls through to the "not curated" branch, mutates whatever list happens
// to be on disk for minutes, and only then fails — with a message about the wrong
// thing.
if (!SCOPES.includes(scope)) {
  throw new Error(`Unsupported MUTATION_SCOPE: "${scope}". Expected one of: ${SCOPES.join(', ')}.`);
}

// Fail loud on an out-of-range index instead of letting `index % total` wrap and
// silently collide with another shard — that would produce a plausible (correct
// shard count) but wrong partition the merge gate could not detect.
if (index >= total) {
  throw new Error(
    `MUTATION_SHARD_INDEX (${index}) must be less than MUTATION_SHARD_TOTAL (${total}).`
  );
}

const LIST_PATH = new URL('./reports/mutation/mutate-list.txt', import.meta.url);
const GATE_PATH = new URL('./reports/mutation/gate.json', import.meta.url);

/**
 * Refuse a mutate list this run did not ask for.
 *
 * Both artifacts are fixed paths, so a leftover pair from a different scope — a
 * local `full` census before a `changed` run, a restored cache in CI — would be
 * mutated happily while the merge gate enforced a threshold resolved for
 * something else. Cross-checking the scope and the count makes that fail closed.
 */
function assertListMatchesDecision(files) {
  if (!existsSync(GATE_PATH)) {
    throw new Error(
      `MUTATION_SCOPE="${scope}" needs reports/mutation/gate.json alongside the ` +
        'mutate list; run `make mutation-file-list` first.'
    );
  }
  const decision = JSON.parse(readFileSync(GATE_PATH, 'utf8'));
  if (decision.scope !== scope) {
    throw new Error(
      `reports/mutation/gate.json was resolved for scope "${decision.scope}" but this ` +
        `run is "${scope}"; re-run \`make mutation-file-list\`.`
    );
  }
  if (decision.fileCount !== files.length) {
    throw new Error(
      `reports/mutation/gate.json counts ${decision.fileCount} file(s) but the mutate ` +
        `list holds ${files.length}; the two artifacts are out of step.`
    );
  }
}

/**
 * The file set this shard partitions.
 *
 * `curated` is the explicit list in the base config. `changed` and `full` are
 * resolved ahead of the run by `scripts/ci/mutation-file-list.ts`, which writes
 * `reports/mutation/mutate-list.txt` and the matching gate decision — one
 * resolution step, so the mutated files and the enforced threshold agree.
 */
function scopedFiles() {
  if (scope === 'curated') {
    return base.mutate;
  }
  if (!existsSync(LIST_PATH)) {
    throw new Error(
      `MUTATION_SCOPE="${scope}" needs reports/mutation/mutate-list.txt; ` +
        'run `make mutation-file-list` first.'
    );
  }
  const files = readFileSync(LIST_PATH, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  if (files.length === 0) {
    throw new Error(
      `MUTATION_SCOPE="${scope}" resolved no mutable files; ` +
        'the caller must skip the run, not mutate nothing.'
    );
  }
  assertListMatchesDecision(files);
  return files;
}

// Sorting first makes the partition stable regardless of source order, and the
// round-robin split (`i % total === index`) guarantees the union of every shard
// equals the full list exactly — no file is dropped or double-counted — so the
// merged score is identical to an unsharded run.
const sliced = [...scopedFiles()]
  .sort((a, b) => a.localeCompare(b))
  .filter((_, i) => i % total === index);

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  ...base,
  mutate: sliced,
  // Emit a machine-readable per-shard report the merge job unions; `break: null`
  // lets an individual shard finish without gating — the merge job re-enforces
  // the real threshold for the scope over the union.
  reporters: ['json', 'clear-text', 'progress'],
  jsonReporter: { fileName: `reports/mutation/mutation-shard-${index}.json` },
  thresholds: { ...base.thresholds, break: null },
};

export default config;
