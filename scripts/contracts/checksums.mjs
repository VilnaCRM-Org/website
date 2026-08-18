import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { load } from 'js-yaml';

import { normalizeSpec } from '../fetchSwaggerSchema.mjs';

export const CHECKSUMS_PATH = 'contracts/user-service/checksums.json';
export const OPENAPI_ARTIFACT = 'contracts/user-service/openapi.json';
export const SCHEMA_ARTIFACT = 'contracts/user-service/schema.graphql';

export const ALGORITHM = 'sha256';

/**
 * A ref that cannot silently change under a committed digest. A 40-character
 * commit SHA is immutable by construction; a release tag is immutable by
 * convention plus the digest recorded here, which is what makes a moved tag a
 * loud failure instead of a silent swap. Anything branch-shaped (`main`,
 * `develop`, `HEAD`, `latest`) floats by design and is rejected outright.
 */
const COMMIT_SHA = /^[0-9a-f]{40}$/;
const RELEASE_TAG = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function isImmutableRef(ref) {
  return COMMIT_SHA.test(ref) || RELEASE_TAG.test(ref);
}

export function digest(text) {
  return createHash(ALGORITHM).update(text, 'utf8').digest('hex');
}

/**
 * The canonical form the digest is taken over — deliberately NOT the file bytes.
 *
 * The committed OpenAPI document is inside the `make format` glob, so Prettier
 * owns its whitespace; a byte digest would break on every reformat while
 * catching nothing real. Re-serializing the parsed document is also the exact
 * form the drift check compares upstream against (see `checkArtifactsMatchPin`),
 * so one fetched YAML document and its committed JSON artifact produce the same
 * digest.
 */
export function canonicalizeOpenapiDocument(doc) {
  return JSON.stringify(normalizeSpec(doc));
}

export function openapiDigestFromJson(jsonText) {
  return digest(canonicalizeOpenapiDocument(JSON.parse(jsonText)));
}

export function openapiDigestFromYaml(yamlText) {
  return digest(canonicalizeOpenapiDocument(load(yamlText)));
}

/**
 * The GraphQL SDL is committed verbatim — no parse, no reformat, not in the
 * Prettier glob — so its canonical form is the file itself.
 */
export function graphqlDigest(sdl) {
  return digest(sdl);
}

export function readChecksums(readFile = readFileSync) {
  const raw = readFile(CHECKSUMS_PATH, 'utf8');
  const parsed = JSON.parse(raw);

  if (parsed.algorithm !== ALGORITHM) {
    throw new Error(
      `${CHECKSUMS_PATH}: unsupported algorithm "${parsed.algorithm}" (expected "${ALGORITHM}")`
    );
  }
  if (!parsed.artifacts || typeof parsed.artifacts !== 'object') {
    throw new Error(`${CHECKSUMS_PATH}: missing an "artifacts" object`);
  }

  return parsed.artifacts;
}

export function computeCommittedDigests(readFile = readFileSync) {
  return {
    [OPENAPI_ARTIFACT]: openapiDigestFromJson(readFile(OPENAPI_ARTIFACT, 'utf8')),
    [SCHEMA_ARTIFACT]: graphqlDigest(readFile(SCHEMA_ARTIFACT, 'utf8')),
  };
}

/**
 * Compares every committed artifact against its recorded digest and returns one
 * message per problem (empty means clean). Hermetic on purpose: this is the half
 * of the supply-chain gate that runs without network, so a tampered artifact
 * fails even when `raw.githubusercontent.com` is unreachable.
 */
export function verifyCommittedDigests(readFile = readFileSync) {
  const recorded = readChecksums(readFile);
  const actual = computeCommittedDigests(readFile);

  return Object.entries(actual).flatMap(([artifact, hash]) => {
    const expected = recorded[artifact];

    if (expected === undefined) {
      return [`${artifact}: no digest recorded in ${CHECKSUMS_PATH}`];
    }
    if (expected !== hash) {
      return [
        `${artifact}: ${ALGORITHM} ${hash} does not match the recorded ${expected} — ` +
          'run `make update-contracts`',
      ];
    }
    return [];
  });
}

export function buildChecksumsFile(readFile = readFileSync) {
  return {
    comment:
      'Canonical SHA-256 digests of the vendored user-service contracts. The digest is ' +
      'taken over the parsed OpenAPI document and the verbatim GraphQL SDL, so Prettier ' +
      'reformatting never invalidates it. lint-contracts verifies these offline and the ' +
      'Apollo mock refuses a fetched schema that does not match — regenerate only through ' +
      '`make update-contracts`, never by hand.',
    algorithm: ALGORITHM,
    artifacts: computeCommittedDigests(readFile),
  };
}
