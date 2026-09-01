import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { intersectIgnores, parseIgnoreEntries, renderIgnoreConfig } from './osv-ignores';

/**
 * Emit the ignore policy the blocking scan is allowed to honour (issue #356).
 *
 * The blocking diff must reflect the policy that will be in force AFTER the merge, so it runs
 * under the intersection of the base ref's ignores and the working tree's — never one side
 * alone. See `intersectIgnores` for why each one-sided set is excluded.
 *
 * Reads OSV_BASE_CONFIG and OSV_CONFIG, writes OSV_EFFECTIVE_CONFIG. A missing file on either
 * side is read as "no ignores", which is the strictest reading and keeps the first run of the
 * gate — when the base ref has no config at all — from depending on one existing.
 */

function readEntries(path: string | undefined): ReturnType<typeof parseIgnoreEntries> {
  if (path === undefined || path.trim() === '' || !existsSync(path)) {
    return [];
  }
  return parseIgnoreEntries(readFileSync(path, 'utf8'), path);
}

function main(): void {
  const out = process.env.OSV_EFFECTIVE_CONFIG;
  if (out === undefined || out.trim() === '') {
    throw new Error('OSV_EFFECTIVE_CONFIG must name the file to write.');
  }

  const base = readEntries(process.env.OSV_BASE_CONFIG);
  const head = readEntries(process.env.OSV_CONFIG);
  const effective = intersectIgnores(base, head);

  writeFileSync(out, renderIgnoreConfig(effective), 'utf8');
  process.stderr.write(
    `Effective ignore policy: ${effective.length} of ${base.length} base entr(ies) retained ` +
      `(${head.length} in the working tree).\n`
  );
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
