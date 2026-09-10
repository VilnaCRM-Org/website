#!/usr/bin/env node
/**
 * Compares two GraphQL SDL documents and reports the breaking changes between
 * them (issue #348). Invoked by scripts/ci/graphql-drift.sh.
 *
 * `findBreakingChanges` from the `graphql` package IS this comparison — the same
 * classification graphql-inspector wraps — so the gate needs no new dependency
 * beyond the one Apollo already pulls in.
 *
 * Exit codes mirror the calling script's three-way contract, so a helper that
 * cannot parse a document is never published as an API change:
 *   0 — no breaking change
 *   1 — breaking changes found (markdown list on stdout)
 *   2 — the comparison could not run
 */
import { readFileSync } from 'node:fs';

import { buildSchema, findBreakingChanges } from 'graphql';

const EXIT_DRIFT = 1;
const EXIT_UNAVAILABLE = 2;

const [baselinePath, revisionPath] = process.argv.slice(2);

if (!baselinePath || !revisionPath) {
  process.stderr.write('usage: graphql-drift-compare.mjs <baseline.graphql> <revision.graphql>\n');
  process.exit(EXIT_UNAVAILABLE);
}

function load(label, file) {
  try {
    return buildSchema(readFileSync(file, 'utf8'));
  } catch (error) {
    process.stderr.write(`could not read the ${label} schema ${file}: ${error.message}\n`);
    process.exit(EXIT_UNAVAILABLE);
  }
  // Unreachable: process.exit does not return. Kept off the happy path only.
  return undefined;
}

const baseline = load('baseline', baselinePath);
const revision = load('upstream', revisionPath);

const changes = findBreakingChanges(baseline, revision);

if (changes.length === 0) {
  process.exit(0);
}

changes.forEach(({ type, description }) => {
  process.stdout.write(`- **${type}** — ${description}\n`);
});

process.exit(EXIT_DRIFT);
