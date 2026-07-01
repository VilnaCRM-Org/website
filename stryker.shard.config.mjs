import base from './stryker.config.mjs';

const total = Math.max(1, Number.parseInt(process.env.MUTATION_SHARD_TOTAL ?? '1', 10) || 1);
const index = Math.max(0, Number.parseInt(process.env.MUTATION_SHARD_INDEX ?? '0', 10) || 0);

// Fail loud on an out-of-range index instead of letting `index % total` wrap and
// silently collide with another shard — that would produce a plausible (correct
// shard count) but wrong partition the merge gate could not detect.
if (index >= total) {
  throw new Error(
    `MUTATION_SHARD_INDEX (${index}) must be less than MUTATION_SHARD_TOTAL (${total}).`
  );
}

// The base config enumerates the mutated files explicitly (an array, not a
// glob), so the shard slices that array deterministically. Sorting first makes
// the partition stable regardless of source order, and the round-robin split
// (`i % total === index`) guarantees the union of every shard equals the full
// list exactly — no file is dropped or double-counted — so the merged score is
// identical to an unsharded run.
const sliced = [...base.mutate]
  .sort((a, b) => a.localeCompare(b))
  .filter((_, i) => i % total === index);

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  ...base,
  mutate: sliced,
  // Emit a machine-readable per-shard report the merge job unions; `break: null`
  // lets an individual shard finish without gating — the merge job re-enforces
  // the real `thresholds.break` from stryker.config.mjs over the union.
  reporters: ['json', 'clear-text', 'progress'],
  jsonReporter: { fileName: `reports/mutation/mutation-shard-${index}.json` },
  thresholds: { ...base.thresholds, break: null },
};

export default config;
