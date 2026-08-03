/**
 * @jest-environment node
 *
 * Contract: the Mockoon the parity gate boots is the Mockoon the e2e suite gets.
 *
 * `Mockoon.Dockerfile` installs `@mockoon/cli` globally; the parity gate drives
 * `@mockoon/commons-server` in-process (the libraries that CLI is a wrapper
 * over). Mockoon's OpenAPI conversion lives in those libraries, so if the two
 * pins drift the gate would certify a mock the e2e stack never runs — the exact
 * failure mode issue #350 exists to prevent, reintroduced one level down.
 *
 * The fix for a red run here is to move BOTH pins together, never to relax this
 * assertion. `@mockoon/cli` depends on an exact (`=`) `@mockoon/commons-server`
 * of the same version, so "same version string" is the right invariant.
 *
 * Scenario coverage (agents.md step 2):
 *   - Positive — the pins agree today.
 *   - Negative — the parse guards below fail loudly if the pin can no longer be
 *     read (a reworded Dockerfile line, a moved dependency), rather than
 *     silently comparing `undefined` to `undefined`.
 *   - Boundary / locale / a11y — Not applicable: this compares two version
 *     strings in committed files.
 */
import { readFileSync } from 'node:fs';

const MOCKOON_DOCKERFILE = 'Mockoon.Dockerfile';
const MOCKOON_LIBRARIES = ['@mockoon/commons', '@mockoon/commons-server'] as const;

interface PackageManifest {
  readonly devDependencies?: Readonly<Record<string, string>>;
}

function cliVersionFromDockerfile(): string {
  const dockerfile = readFileSync(MOCKOON_DOCKERFILE, 'utf8');
  const pin = /@mockoon\/cli@(\d+\.\d+\.\d+)/.exec(dockerfile);

  if (pin?.[1] === undefined) {
    throw new Error(`${MOCKOON_DOCKERFILE} no longer pins @mockoon/cli@<version>`);
  }
  return pin[1];
}

describe('the mocked API is pinned to one Mockoon version', () => {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as PackageManifest;
  const cliVersion = cliVersionFromDockerfile();

  it.each(MOCKOON_LIBRARIES)('%s matches the CLI version the e2e image installs', library => {
    // Exact pins only: a range would let the gate and the image resolve
    // different builds of the same conversion code.
    expect(manifest.devDependencies?.[library]).toBe(cliVersion);
  });
});
