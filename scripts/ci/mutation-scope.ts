import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Which slice of the tree a mutation run covers (#345).
 *
 * - `curated` — the hand-picked list in `stryker.config.mjs`, gated at 100%.
 * - `changed` — only the mutable files a pull request touches, gated at a lower
 *   bar so a first-time-mutated file does not block an unrelated change.
 * - `full`    — every mutable file in the tree, advisory: it measures the
 *   backlog nobody's pull request created and must never redden a pull request.
 */
export type MutationScope = 'curated' | 'changed' | 'full';

/** What a resolved scope does to the build. */
export type GateMode = 'gate' | 'advisory' | 'skip';

/** Per-scope policy as declared in `config/mutation-policy.json`. */
export interface ScopePolicy {
  /** Minimum mutation score, in percent, below which a gating run fails. */
  break: number;
  /** When true the scope only reports; it never fails the build. */
  advisory: boolean;
  /** Optional file-count ceiling above which a gating scope degrades to advisory. */
  maxFiles?: number;
}

/** The whole policy document. */
export interface MutationPolicy {
  /** Path segments that mark a directory as carrying mutable logic. */
  mutableDirectories: string[];
  scopes: Record<MutationScope, ScopePolicy>;
}

/** The outcome of applying a scope's policy to a concrete file set. */
export interface GateDecision {
  mode: GateMode;
  /** The break threshold to enforce, or `null` when the run does not gate. */
  break: number | null;
  /** Human-readable justification, echoed into the job log and step summary. */
  reason: string;
}

const POLICY_PATH = resolve(process.cwd(), 'config', 'mutation-policy.json');

const SCOPES: readonly MutationScope[] = ['curated', 'changed', 'full'];

/**
 * Paths that carry no behaviour worth mutating. Mutating them produces
 * equivalent mutants (a re-ordered style object behaves identically) that no
 * test can kill, which renders the gate unfalsifiable rather than strict.
 */
const NON_MUTABLE = [
  /^src\/test\//,
  /\.d\.ts$/,
  /\.stories\.tsx?$/,
  /\.test\.tsx?$/,
  /(^|\/)types?(\/|\.tsx?$)/,
  /(^|\/)styles?(\/|\.tsx?$)/,
  /(^|\/)i18n\//,
  /(^|\/)assets\//,
  /(^|\/)constants(\/|\.tsx?$)/,
  /(^|\/)__mocks__\//,
  /(^|\/)__fixtures__\//,
];

/** Reject anything that is not a non-empty array of non-empty strings. */
function assertStringList(value: unknown, field: string): string[] {
  const ok =
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(v => typeof v === 'string' && v.length > 0);
  if (!ok) {
    throw new TypeError(
      `config/mutation-policy.json: "${field}" must be a non-empty array of strings.`
    );
  }
  return value as string[];
}

/** Reject a scope entry that could silently disable the gate. */
function assertScopePolicy(value: unknown, scope: MutationScope): ScopePolicy {
  const entry = value as Partial<ScopePolicy> | undefined;
  if (typeof entry?.break !== 'number' || entry.break < 0 || entry.break > 100) {
    throw new TypeError(
      `config/mutation-policy.json: scope "${scope}" needs a numeric "break" in [0, 100].`
    );
  }
  if (typeof entry.advisory !== 'boolean') {
    throw new TypeError(
      `config/mutation-policy.json: scope "${scope}" needs a boolean "advisory".`
    );
  }
  if (entry.maxFiles !== undefined && (!Number.isInteger(entry.maxFiles) || entry.maxFiles <= 0)) {
    throw new TypeError(
      `config/mutation-policy.json: scope "${scope}" has a non-positive "maxFiles".`
    );
  }
  return entry.maxFiles === undefined
    ? { break: entry.break, advisory: entry.advisory }
    : { break: entry.break, advisory: entry.advisory, maxFiles: entry.maxFiles };
}

/** Parse and validate the policy; throw rather than gate on a malformed one. */
export function loadMutationPolicy(path: string = POLICY_PATH): MutationPolicy {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read the mutation policy at "${path}": ${String(error)}`);
  }

  const doc = raw as Partial<MutationPolicy>;
  const scopes = {} as Record<MutationScope, ScopePolicy>;
  for (const scope of SCOPES) {
    scopes[scope] = assertScopePolicy(doc.scopes?.[scope], scope);
  }
  return {
    mutableDirectories: assertStringList(doc.mutableDirectories, 'mutableDirectories'),
    scopes,
  };
}

/** Narrow an arbitrary string to a known scope, failing loud on a typo in a CI job. */
export function parseScope(value: string | undefined): MutationScope {
  const scope = value ?? 'curated';
  if (!SCOPES.includes(scope as MutationScope)) {
    throw new Error(
      `Unsupported MUTATION_SCOPE: "${scope}". Expected one of: ${SCOPES.join(', ')}.`
    );
  }
  return scope as MutationScope;
}

/** Strip a `./` prefix and collapse Windows separators so path matching is uniform. */
function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * True when `path` is a TypeScript source file living under a mutable
 * directory. The directory test is on whole path segments, so `api/` matches
 * but a presentational `api-documentation/` component does not.
 */
export function isMutablePath(path: string, mutableDirectories: readonly string[]): boolean {
  const normalized = normalizePath(path);
  if (!normalized.startsWith('src/') || !/\.tsx?$/.test(normalized)) {
    return false;
  }
  if (NON_MUTABLE.some(pattern => pattern.test(normalized))) {
    return false;
  }
  const segments = normalized.split('/').slice(0, -1);
  return segments.some(segment => mutableDirectories.includes(segment));
}

/** Filter, de-duplicate, and sort candidate paths into a deterministic mutate list. */
export function selectMutableFiles(
  paths: readonly string[],
  mutableDirectories: readonly string[]
): string[] {
  const kept = new Set<string>();
  for (const path of paths) {
    const normalized = normalizePath(path);
    if (normalized.length > 0 && isMutablePath(normalized, mutableDirectories)) {
      kept.add(normalized);
    }
  }
  return [...kept].sort((a, b) => a.localeCompare(b));
}

/**
 * Round-robin slice of `files` for one shard. The union of every index in
 * `[0, total)` is exactly `files`, so a sharded run scores identically to an
 * unsharded one — no file is dropped or counted twice.
 */
export function partitionFiles(files: readonly string[], total: number, index: number): string[] {
  if (!Number.isInteger(total) || total < 1) {
    throw new Error(`MUTATION_SHARD_TOTAL (${total}) must be a positive integer.`);
  }
  if (!Number.isInteger(index) || index < 0 || index >= total) {
    throw new Error(`MUTATION_SHARD_INDEX (${index}) must be an integer in [0, ${total}).`);
  }
  return [...files].sort((a, b) => a.localeCompare(b)).filter((_, i) => i % total === index);
}

/**
 * Decide what a run over `fileCount` files does to the build.
 *
 * An empty set is a no-op rather than a vacuous pass: Stryker reports a `NaN`
 * score with zero mutants, and treating that as 100% would let a mis-filtered
 * list silently disable the gate.
 */
export function resolveGate(
  scope: MutationScope,
  fileCount: number,
  policy: MutationPolicy
): GateDecision {
  const entry = policy.scopes[scope];
  if (fileCount <= 0) {
    return {
      mode: 'skip',
      break: null,
      reason: `No mutable files in scope "${scope}"; nothing to mutate.`,
    };
  }
  if (entry.advisory) {
    return {
      mode: 'advisory',
      break: null,
      reason:
        `Scope "${scope}" is advisory: reporting the score over ` +
        `${fileCount} file(s) without gating.`,
    };
  }
  if (entry.maxFiles !== undefined && fileCount > entry.maxFiles) {
    return {
      mode: 'advisory',
      break: null,
      reason:
        `Scope "${scope}" touches ${fileCount} mutable file(s), above the ` +
        `${entry.maxFiles}-file cap; reporting without gating so a wide refactor ` +
        'is not blocked by a run that cannot finish in time.',
    };
  }
  return {
    mode: 'gate',
    break: entry.break,
    reason: `Scope "${scope}" gates ${fileCount} file(s) at a ${entry.break}% mutation score.`,
  };
}
