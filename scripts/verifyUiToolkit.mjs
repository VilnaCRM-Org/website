/**
 * Offline integrity check for the `@vilnacrm/ui-toolkit` dependency.
 *
 * The package is consumed as a GitHub release tarball rather than from a
 * registry, and bun records NO `sha512` for a remote-tarball dependency — its
 * `bun.lock` entry is `[spec, {peerDependencies}]`, not the four-element
 * registry form. The pin is immutable by URL, but nothing local verifies that
 * the bytes behind that URL are the bytes the pin was reviewed against, and
 * `osv-scanner` cannot key a tarball entry either. This script is that missing
 * check: it hashes the INSTALLED build artifacts and compares them with digests
 * committed to the repository.
 *
 * It is deliberately hermetic — no network, no host binary, no Docker — so it
 * can sit inside `make lint` and run on every pull request.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const CHECKSUMS_PATH = 'config/ui-toolkit-checksums.json';
export const PACKAGE_ROOT = 'node_modules/@vilnacrm/ui-toolkit';
export const MANIFEST_PATH = 'package.json';
export const ALGORITHM = 'sha256';

/** Digest over the raw bytes: these are build outputs, never reformatted. */
export function digest(bytes) {
  return createHash(ALGORITHM).update(bytes).digest('hex');
}

function readJson(path, readFile) {
  return JSON.parse(readFile(path, 'utf8'));
}

export function readChecksums(readFile = readFileSync) {
  const parsed = readJson(CHECKSUMS_PATH, readFile);

  if (parsed.algorithm !== ALGORITHM) {
    throw new Error(
      `${CHECKSUMS_PATH}: unsupported algorithm ${String(parsed.algorithm)}; expected ${ALGORITHM}`
    );
  }
  const artifacts = parsed.artifacts;
  if (!artifacts || Object.keys(artifacts).length === 0) {
    throw new Error(`${CHECKSUMS_PATH}: declares no artifacts, so it would verify nothing`);
  }
  return parsed;
}

/**
 * The version the manifest pins, read off the release URL rather than a
 * separate variable: the URL is the only thing that actually decides which
 * bytes are installed, so a second declaration could only ever disagree with it.
 */
export function pinnedVersion(readFile = readFileSync) {
  const manifest = readJson(MANIFEST_PATH, readFile);
  const spec = manifest.dependencies?.['@vilnacrm/ui-toolkit'];

  if (typeof spec !== 'string') {
    throw new Error(`${MANIFEST_PATH}: @vilnacrm/ui-toolkit is not a dependency`);
  }
  const match = /\/releases\/download\/v([^/]+)\//.exec(spec);
  if (!match) {
    throw new Error(
      `${MANIFEST_PATH}: @vilnacrm/ui-toolkit must be pinned to a release-tarball URL, got ${spec}`
    );
  }
  return match[1];
}

export function installedVersion(readFile = readFileSync) {
  return readJson(`${PACKAGE_ROOT}/package.json`, readFile).version;
}

/**
 * Every failure is collected rather than thrown at the first one: a contributor
 * refreshing the pin wants the whole list in a single run.
 */
export function verify(readFile = readFileSync) {
  const failures = [];
  const checksums = readChecksums(readFile);

  const pinned = pinnedVersion(readFile);
  if (checksums.version !== pinned) {
    failures.push(
      `${CHECKSUMS_PATH} records version ${checksums.version}, manifest pins ${pinned}`
    );
  }

  let installed;
  try {
    installed = installedVersion(readFile);
  } catch {
    failures.push(
      `${PACKAGE_ROOT} is not installed; run \`bun install\` before the gate rather than skipping it`
    );
    return failures;
  }
  if (installed !== pinned) {
    failures.push(`installed @vilnacrm/ui-toolkit is ${installed}, manifest pins ${pinned}`);
  }

  Object.entries(checksums.artifacts).forEach(([relativePath, expected]) => {
    let actual;
    try {
      actual = digest(readFile(`${PACKAGE_ROOT}/${relativePath}`));
    } catch {
      failures.push(`${relativePath}: missing from the installed package`);
      return;
    }
    if (actual !== expected) {
      failures.push(`${relativePath}: digest ${actual} does not match committed ${expected}`);
    }
  });

  return failures;
}

export function buildChecksumsFile(readFile = readFileSync) {
  const current = readChecksums(readFile);
  const artifacts = {};

  Object.keys(current.artifacts).forEach(relativePath => {
    artifacts[relativePath] = digest(readFile(`${PACKAGE_ROOT}/${relativePath}`));
  });

  return { ...current, version: pinnedVersion(readFile), artifacts };
}

/**
 * The gate's whole behaviour, with its io injected so it is testable: returns
 * the process exit code and writes the report through the given sinks. The
 * thin `verifyUiToolkit.cli.mjs` wrapper is the only thing that touches
 * `process`, which keeps every branch that decides pass or fail reachable from
 * a spec.
 */
export function main({ readFile = readFileSync, stdout, stderr } = {}) {
  try {
    const failures = verify(readFile);
    if (failures.length > 0) {
      stderr(`ui-toolkit integrity: FAIL\n${failures.map(failure => `  - ${failure}\n`).join('')}`);
      return 1;
    }
    const count = Object.keys(readChecksums(readFile).artifacts).length;
    stdout(`ui-toolkit integrity: OK (v${pinnedVersion(readFile)}, ${count} artifacts verified)\n`);
    return 0;
  } catch (error) {
    stderr(`ui-toolkit integrity: FAIL\n  - ${error.message}\n`);
    return 1;
  }
}
