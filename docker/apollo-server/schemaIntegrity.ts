import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Integrity check for the one contract this repo still pulls over the network at
 * run time.
 *
 * `contracts/user-service/schema.graphql` is vendored and reviewed, and
 * `Apollo.Dockerfile` seeds it into the image — but `schemaFetcher` then
 * re-fetches the same document from a mutable git tag and overwrites the seed
 * with whatever the tag points at today, with no verification. That turns a
 * moved tag upstream into a silent swap of the schema the whole dev/CI mock is
 * built against. Verifying the fetched bytes against the digest committed
 * alongside the artifact makes that swap a loud, logged rejection instead: the
 * download is discarded and the seeded contract stays in place.
 *
 * The digest is recomputed here rather than imported from
 * `scripts/contracts/checksums.mjs`: `Apollo.Dockerfile` copies only `docker/`
 * and `contracts/` into the image, so the build scripts are not on disk at run
 * time. The GraphQL canonical form is the verbatim file, so "recompute" is a
 * single `sha256` of the text.
 */
export const SCHEMA_ARTIFACT: string = 'contracts/user-service/schema.graphql';

const CHECKSUMS_RELATIVE: string = path.join('contracts', 'user-service', 'checksums.json');

/**
 * Walks up from this module to the directory holding `contracts/`.
 *
 * The depth differs between the two layouts this file runs in — `out/docker/
 * apollo-server/` inside the image, `docker/apollo-server/` in the source tree
 * the unit suite imports — so counting `..` segments is wrong in one of them.
 * When nothing is found, falls back to the compiled layout's root — but only if
 * walking up that far stays inside `from`, so a shallow path cannot report an
 * expected file at the filesystem root.
 */
export function locateChecksums(from: string = __dirname): string {
  const candidates: string[] = [];
  let dir: string = from;

  for (let up: number = 0; up < 6; up += 1) {
    const candidate: string = path.join(dir, CHECKSUMS_RELATIVE);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    candidates.push(candidate);

    const parent: string = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  // Name the compiled layout's root (out/docker/apollo-server -> /app) when the
  // walk got that far, otherwise the deepest directory it actually reached.
  return candidates[Math.min(3, candidates.length - 1)] as string;
}

export const CHECKSUMS_PATH: string = locateChecksums();

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Reads the digest recorded for the GraphQL SDL.
 *
 * Returns `null` when the checksums file is absent, unreadable, not valid JSON,
 * records no `artifacts` object, or records no entry for the schema artifact.
 * Callers treat every one of those as "cannot verify" and must fail closed
 * rather than accept the document.
 */
export function readExpectedSchemaDigest(checksumsPath: string = CHECKSUMS_PATH): string | null {
  let raw: string;
  try {
    raw = fs.readFileSync(checksumsPath, 'utf-8');
  } catch {
    return null;
  }

  try {
    const parsed: { artifacts?: Record<string, string> } = JSON.parse(raw);
    return parsed.artifacts?.[SCHEMA_ARTIFACT] ?? null;
  } catch {
    return null;
  }
}

export class SchemaIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaIntegrityError';
  }
}

/**
 * Throws unless `sdl` is byte-identical to the committed, reviewed artifact.
 * A missing digest is itself a failure: an unverifiable document must not
 * overwrite the seeded one.
 */
export function assertSchemaIntegrity(sdl: string, expected: string | null): void {
  if (expected === null) {
    throw new SchemaIntegrityError(
      `No digest recorded for ${SCHEMA_ARTIFACT} in ${CHECKSUMS_PATH} — ` +
        'refusing to overwrite the vendored schema with an unverifiable download.'
    );
  }

  const actual: string = sha256(sdl);
  if (actual !== expected) {
    throw new SchemaIntegrityError(
      `Fetched GraphQL schema does not match the pinned contract: sha256 ${actual} ` +
        `!= ${expected}. The pinned ref moved or the download was tampered with; ` +
        'run `make update-contracts` and review the diff.'
    );
  }
}
