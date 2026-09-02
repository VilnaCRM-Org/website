/**
 * The shape of the single user-service pin.
 *
 * Its own module so both the fetch scripts and the contract gate can require an
 * immutable ref without importing each other: checksums.mjs already imports
 * fetchSwaggerSchema.mjs for `normalizeSpec`, so putting this there and reading
 * it back from the fetch scripts would close a cycle.
 */

/**
 * A ref that cannot silently change under a committed digest. A 40-character
 * commit SHA is immutable by construction; a release tag is immutable by
 * convention plus the digest recorded in checksums.json, which is what makes a
 * moved tag a loud failure instead of a silent swap. Anything branch-shaped
 * (`main`, `develop`, `HEAD`, `latest`) floats by design and is rejected.
 */
const COMMIT_SHA = /^[0-9a-f]{40}$/;
const RELEASE_TAG = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function isImmutableRef(ref) {
  return COMMIT_SHA.test(ref) || RELEASE_TAG.test(ref);
}

export function immutableRefError(ref) {
  return (
    `USER_SERVICE_VERSION="${ref}" is not an immutable ref — use a 40-character ` +
    'commit SHA or a vMAJOR.MINOR.PATCH release tag, never a branch'
  );
}

/**
 * Reads the pin and refuses anything that floats.
 *
 * Called by the fetch scripts before the download, not only by the gate: a
 * branch-shaped pin used to be fetched, vendored and digested successfully, and
 * only failed on the next `make lint-contracts`.
 */
export function requireImmutableUserServiceVersion() {
  const version = process.env.USER_SERVICE_VERSION;

  if (!version) {
    throw new Error(
      'USER_SERVICE_VERSION is not set — define it in .env (the single user-service pin).'
    );
  }
  if (!isImmutableRef(version)) {
    throw new Error(immutableRefError(version));
  }

  return version;
}
