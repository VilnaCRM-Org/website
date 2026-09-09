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
import { readdirSync, readFileSync } from 'node:fs';

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

/**
 * Every file the package ships under `build/`, relative to it.
 *
 * The whole tree, not a chosen few: a subpath entry such as `build/ui-button.mjs`
 * re-exports out of `build/chunks/*.mjs` and never loads `build/index.mjs`, so a
 * digest set covering only the barrel would verify code the application never
 * runs while leaving the code it does run unchecked.
 */
export function listBuildFiles(readDir = readdirSync, prefix = '') {
  const entries = readDir(`${PACKAGE_ROOT}/build${prefix}`, { withFileTypes: true });

  return entries
    .flatMap(entry =>
      entry.isDirectory()
        ? listBuildFiles(readDir, `${prefix}/${entry.name}`)
        : [`build${prefix}/${entry.name}`]
    )
    .sort();
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
export function manifestSpec(readFile = readFileSync) {
  const spec = readJson(MANIFEST_PATH, readFile).dependencies?.['@vilnacrm/ui-toolkit'];

  if (typeof spec !== 'string') {
    throw new Error(`${MANIFEST_PATH}: @vilnacrm/ui-toolkit is not a dependency`);
  }
  return spec;
}

export function pinnedVersion(readFile = readFileSync) {
  const spec = manifestSpec(readFile);

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
export function verify(readFile = readFileSync, readDir = readdirSync) {
  const failures = [];
  const checksums = readChecksums(readFile);

  const pinned = pinnedVersion(readFile);
  if (checksums.version !== pinned) {
    failures.push(
      `${CHECKSUMS_PATH} records version ${checksums.version}, manifest pins ${pinned}`
    );
  }
  // The recorded URL is a third statement of the pin, and an unchecked
  // restatement is exactly the drift this gate exists to catch.
  if (checksums.tarballUrl !== manifestSpec(readFile)) {
    failures.push(`${CHECKSUMS_PATH} tarballUrl does not match the manifest's pinned release URL`);
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

  // An ADDED file is tampering too — a digest set that only checks the files it
  // already knows about can be defeated by shipping an extra module.
  let installedFiles;
  try {
    installedFiles = listBuildFiles(readDir);
  } catch {
    failures.push(`${PACKAGE_ROOT}/build is unreadable, so the artifact set cannot be verified`);
    return failures;
  }
  installedFiles
    .filter(relativePath => !(relativePath in checksums.artifacts))
    .forEach(relativePath => {
      failures.push(`${relativePath}: present in the install but absent from ${CHECKSUMS_PATH}`);
    });

  return failures;
}

export function buildChecksumsFile(readFile = readFileSync, readDir = readdirSync) {
  const current = readChecksums(readFile);
  const artifacts = {};

  [...listBuildFiles(readDir), 'package.json'].forEach(relativePath => {
    artifacts[relativePath] = digest(readFile(`${PACKAGE_ROOT}/${relativePath}`));
  });

  return {
    ...current,
    version: pinnedVersion(readFile),
    tarballUrl: manifestSpec(readFile),
    artifacts,
  };
}

/**
 * The gate's whole behaviour, with its io injected so it is testable: returns
 * the process exit code and writes the report through the given sinks. The
 * thin `verifyUiToolkit.cli.mjs` wrapper is the only thing that touches
 * `process`, which keeps every branch that decides pass or fail reachable from
 * a spec.
 */
export function main({ readFile = readFileSync, readDir = readdirSync, stdout, stderr } = {}) {
  try {
    const failures = verify(readFile, readDir);
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
