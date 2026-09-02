import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  type MutationPolicy,
  capFiles,
  isMutablePath,
  digestFiles,
  hasRelatedTests,
  loadMutationPolicy,
  parseGateArtifact,
  parseScope,
  resolveGate,
  selectMutableFiles,
} from '../../../scripts/ci/mutation-scope';

const DIRS = ['api', 'helpers', 'hooks', 'utils', 'validations'];

const POLICY: MutationPolicy = {
  mutableDirectories: DIRS,
  scopes: {
    curated: { break: 100, advisory: false },
    changed: { break: 85, advisory: false, maxFiles: 3 },
    full: { break: 100, advisory: true },
  },
};

let scratch: string;

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'mutation-policy-'));
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

/** Write a policy document into the scratch dir and return its path. */
function policyFile(name: string, contents: unknown): string {
  const path = join(scratch, name);
  writeFileSync(path, typeof contents === 'string' ? contents : JSON.stringify(contents), 'utf8');
  return path;
}

describe('isMutablePath', () => {
  it.each([
    'src/features/landing/helpers/normalizeLink.ts',
    'src/features/landing/hooks/useFormReset.ts',
    'src/features/landing/api/graphql/apollo.ts',
    'src/features/landing/components/auth-section/validations/email.ts',
    'src/utils/format.tsx',
  ])('accepts logic under a mutable directory: %s', path => {
    expect(isMutablePath(path, DIRS)).toBe(true);
  });

  it.each([
    ['a spec', 'src/test/unit/email-validation.test.ts'],
    ['a declaration file', 'src/features/landing/helpers/env.d.ts'],
    ['a story', 'src/features/landing/hooks/use-thing.stories.tsx'],
    ['a co-located test', 'src/features/landing/helpers/normalizeLink.test.ts'],
    ['a types folder', 'src/features/landing/api/types/user.ts'],
    ['a types module', 'src/features/landing/helpers/types.ts'],
    ['a styles folder', 'src/features/landing/helpers/styles/link.ts'],
    ['an i18n bundle', 'src/features/landing/api/i18n/en.ts'],
    ['an assets folder', 'src/features/landing/utils/assets/icon.ts'],
    ['a constants module', 'src/features/landing/helpers/constants.ts'],
    ['a manual mock', 'src/features/landing/api/__mocks__/client.ts'],
    ['a fixture', 'src/features/landing/api/__fixtures__/user.ts'],
    ['a co-located spec', 'src/features/landing/helpers/normalizeLink.spec.ts'],
    ['a co-located tsx spec', 'src/features/landing/hooks/use-thing.spec.tsx'],
  ])('rejects %s', (_label, path) => {
    expect(isMutablePath(path, DIRS)).toBe(false);
  });

  it('rejects files outside src/', () => {
    expect(isMutablePath('scripts/ci/mutation-scope.ts', DIRS)).toBe(false);
    expect(isMutablePath('pages/api/health.ts', DIRS)).toBe(false);
  });

  it('rejects non-TypeScript sources', () => {
    expect(isMutablePath('src/features/landing/helpers/legacy.js', DIRS)).toBe(false);
    expect(isMutablePath('src/features/landing/helpers/data.json', DIRS)).toBe(false);
  });

  it('matches whole path segments, so a presentational api-documentation/ is not "api"', () => {
    expect(isMutablePath('src/features/swagger/components/api-documentation/index.ts', DIRS)).toBe(
      false
    );
  });

  it('rejects a mutable directory name that only appears in the file name', () => {
    expect(isMutablePath('src/features/landing/components/hooks.ts', DIRS)).toBe(false);
  });

  it('normalises a ./ prefix and Windows separators', () => {
    expect(isMutablePath('./src/features/landing/helpers/normalizeLink.ts', DIRS)).toBe(true);
    expect(isMutablePath('src\\features\\landing\\helpers\\normalizeLink.ts', DIRS)).toBe(true);
  });

  it('rejects the empty path', () => {
    expect(isMutablePath('', DIRS)).toBe(false);
  });

  it('honours an empty mutable-directory list by matching nothing', () => {
    expect(isMutablePath('src/features/landing/helpers/normalizeLink.ts', [])).toBe(false);
  });
});

describe('selectMutableFiles', () => {
  it('filters, de-duplicates, and sorts', () => {
    expect(
      selectMutableFiles(
        [
          'src/features/landing/hooks/useFormReset.ts',
          './src/features/landing/helpers/normalizeLink.ts',
          'src/features/landing/helpers/normalizeLink.ts',
          'README.md',
          '',
          '   ',
        ],
        DIRS
      )
    ).toEqual([
      'src/features/landing/helpers/normalizeLink.ts',
      'src/features/landing/hooks/useFormReset.ts',
    ]);
  });

  it('returns an empty list when nothing is mutable', () => {
    expect(
      selectMutableFiles(['docs/readme.md', 'src/components/ui-button/index.tsx'], DIRS)
    ).toEqual([]);
  });
});

describe('capFiles', () => {
  const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];

  it('truncates to the cap so an advisory verdict also bounds the run', () => {
    expect(capFiles(files, 'changed', POLICY)).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('returns the list unchanged at exactly the cap', () => {
    expect(capFiles(files.slice(0, 3), 'changed', POLICY)).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('leaves a scope without a cap untouched', () => {
    expect(capFiles(files, 'full', POLICY)).toEqual(files);
  });

  it('copies rather than aliasing the input', () => {
    const input = ['a.ts'];
    expect(capFiles(input, 'full', POLICY)).not.toBe(input);
  });

  it('handles an empty list', () => {
    expect(capFiles([], 'changed', POLICY)).toEqual([]);
  });
});

describe('hasRelatedTests', () => {
  it('reports coverage when the runner lists a spec', () => {
    expect(
      hasRelatedTests(
        'src/features/landing/helpers/normalizeLink.ts',
        () => '/repo/src/test/unit/normalizeLink.test.ts\n'
      )
    ).toBe(true);
  });

  it('accepts a .tsx spec', () => {
    expect(hasRelatedTests('src/x.ts', () => '/repo/src/test/testing-library/Foo.test.tsx\n')).toBe(
      true
    );
  });

  it('reports no coverage when the runner exits cleanly with no spec', () => {
    expect(hasRelatedTests('src/features/landing/api/graphql/apollo.ts', () => '')).toBe(false);
  });

  it('ignores runner chatter that is not a spec path', () => {
    expect(hasRelatedTests('src/x.ts', () => 'info - loaded config\nNo tests found\n')).toBe(false);
  });

  it('re-raises a runner failure instead of calling the file unmeasurable', () => {
    // The gate-hole this guards: swallowing a broken Jest would drop every
    // candidate, empty the mutate list, resolve the decision to `skip`, and let
    // the blocking changed leg exit green.
    expect(() =>
      hasRelatedTests('src/x.ts', () => {
        throw new Error('Command failed: bun x jest');
      })
    ).toThrow(/the mutation runner is broken/);
  });

  it('names the file it could not resolve', () => {
    expect(() =>
      hasRelatedTests('src/features/landing/helpers/scrollToAnchor.ts', () => {
        throw new Error('ENOMEM');
      })
    ).toThrow(/scrollToAnchor\.ts/);
  });
});

describe('digestFiles', () => {
  it('is stable for the same list', () => {
    expect(digestFiles(['a.ts', 'b.ts'])).toBe(digestFiles(['a.ts', 'b.ts']));
  });

  it('differs for a different list of the same length', () => {
    expect(digestFiles(['a.ts', 'b.ts'])).not.toBe(digestFiles(['a.ts', 'c.ts']));
  });

  it('differs for the same files in a different order', () => {
    expect(digestFiles(['a.ts', 'b.ts'])).not.toBe(digestFiles(['b.ts', 'a.ts']));
  });

  it('produces a SHA-256 hex digest for the empty list', () => {
    expect(digestFiles([])).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('parseGateArtifact', () => {
  const gate = (over: Record<string, unknown> = {}): string =>
    JSON.stringify({
      mode: 'gate',
      break: 85,
      reason: 'because',
      scope: 'changed',
      fileCount: 2,
      digest: digestFiles(['a.ts', 'b.ts']),
      unmeasured: [],
      ...over,
    });

  it('accepts a well-formed gating decision', () => {
    expect(parseGateArtifact(gate(), 'changed')).toEqual({
      mode: 'gate',
      break: 85,
      reason: 'because',
      scope: 'changed',
      fileCount: 2,
      digest: digestFiles(['a.ts', 'b.ts']),
      unmeasured: [],
    });
  });

  it('accepts an advisory decision with a null break', () => {
    expect(parseGateArtifact(gate({ mode: 'advisory', break: null }), 'changed').break).toBeNull();
  });

  it('rejects malformed JSON', () => {
    expect(() => parseGateArtifact('{ nope', 'changed')).toThrow(/not valid JSON/);
  });

  it('rejects an unknown mode', () => {
    expect(() => parseGateArtifact(gate({ mode: 'warn' }), 'changed')).toThrow(/expected one of/);
  });

  it('rejects a decision resolved for another scope', () => {
    expect(() => parseGateArtifact(gate({ scope: 'full' }), 'changed')).toThrow(/stale decision/);
  });

  it('rejects a gating decision with a null break', () => {
    expect(() => parseGateArtifact(gate({ break: null }), 'changed')).toThrow(/non-numeric break/);
  });

  it('rejects a gating decision whose break is a numeric string', () => {
    expect(() => parseGateArtifact(gate({ break: '85' }), 'changed')).toThrow(/non-numeric break/);
  });

  it('rejects a non-gating decision that still carries a break', () => {
    expect(() => parseGateArtifact(gate({ mode: 'skip', break: 85 }), 'changed')).toThrow(
      /carries a break/
    );
  });

  it('rejects a non-integer fileCount', () => {
    expect(() => parseGateArtifact(gate({ fileCount: 1.5 }), 'changed')).toThrow(/fileCount/);
  });

  it('rejects a decision with no mutate-list digest', () => {
    expect(() => parseGateArtifact(gate({ digest: undefined }), 'changed')).toThrow(/digest/);
  });

  it('rejects a digest that is not a SHA-256 hex string', () => {
    expect(() => parseGateArtifact(gate({ digest: 'nope' }), 'changed')).toThrow(/digest/);
  });

  it('defaults a missing unmeasured list to empty', () => {
    expect(parseGateArtifact(gate({ unmeasured: undefined }), 'changed').unmeasured).toEqual([]);
  });
});

describe('resolveGate', () => {
  it('skips an empty file set rather than passing it vacuously', () => {
    const decision = resolveGate('changed', 0, POLICY);
    expect(decision).toMatchObject({ mode: 'skip', break: null });
  });

  it('gates a changed set at or below the cap', () => {
    expect(resolveGate('changed', 1, POLICY)).toMatchObject({ mode: 'gate', break: 85 });
    expect(resolveGate('changed', 3, POLICY)).toMatchObject({ mode: 'gate', break: 85 });
  });

  it('degrades to advisory one file above the cap', () => {
    const decision = resolveGate('changed', 4, POLICY);
    expect(decision.mode).toBe('advisory');
    expect(decision.break).toBeNull();
    expect(decision.reason).toContain('3-file cap');
  });

  it('never gates an advisory scope', () => {
    expect(resolveGate('full', 200, POLICY)).toMatchObject({ mode: 'advisory', break: null });
  });

  it('gates the curated scope at 100', () => {
    expect(resolveGate('curated', 4, POLICY)).toMatchObject({ mode: 'gate', break: 100 });
  });
});

describe('parseScope', () => {
  it('defaults to the curated scope', () => {
    expect(parseScope(undefined)).toBe('curated');
  });

  it.each([
    ['an empty string', ''],
    ['whitespace', '   '],
  ])('treats %s as the curated default, not an error', (_label, value) => {
    expect(parseScope(value)).toBe('curated');
  });

  it('trims a value that make forwarded with padding', () => {
    expect(parseScope(' full ')).toBe('full');
  });

  it.each(['curated', 'changed', 'full'] as const)('accepts %s', scope => {
    expect(parseScope(scope)).toBe(scope);
  });

  it('rejects an unknown scope instead of silently running the wrong slice', () => {
    expect(() => parseScope('chnaged')).toThrow(/Unsupported MUTATION_SCOPE/);
  });
});

describe('loadMutationPolicy', () => {
  it('loads the policy the repository actually ships', () => {
    const policy = loadMutationPolicy();
    expect(policy.mutableDirectories.length).toBeGreaterThan(0);
    expect(policy.scopes.curated.break).toBe(100);
    expect(policy.scopes.curated.advisory).toBe(false);
    expect(policy.scopes.full.advisory).toBe(true);
  });

  it('keeps the shipped curated threshold in step with the changed-files threshold', () => {
    const policy = loadMutationPolicy();
    expect(policy.scopes.changed.break).toBeLessThanOrEqual(policy.scopes.curated.break);
    expect(policy.scopes.changed.maxFiles).toBeGreaterThan(0);
  });

  it('rejects a missing policy file', () => {
    expect(() => loadMutationPolicy(join(scratch, 'absent.json'))).toThrow(
      /Could not read the mutation policy/
    );
  });

  it('rejects malformed JSON', () => {
    expect(() => loadMutationPolicy(policyFile('broken.json', '{ nope'))).toThrow(
      /Could not read the mutation policy/
    );
  });

  it('rejects an empty mutableDirectories list', () => {
    const path = policyFile('empty-dirs.json', { ...POLICY, mutableDirectories: [] });
    expect(() => loadMutationPolicy(path)).toThrow(/mutableDirectories/);
  });

  it('rejects a non-numeric break', () => {
    const path = policyFile('bad-break.json', {
      ...POLICY,
      scopes: { ...POLICY.scopes, changed: { break: '85', advisory: false } },
    });
    expect(() => loadMutationPolicy(path)).toThrow(/numeric "break"/);
  });

  it('rejects a break outside [0, 100]', () => {
    const path = policyFile('out-of-range.json', {
      ...POLICY,
      scopes: { ...POLICY.scopes, changed: { break: 101, advisory: false } },
    });
    expect(() => loadMutationPolicy(path)).toThrow(/numeric "break"/);
  });

  it('rejects a non-boolean advisory flag', () => {
    const path = policyFile('bad-advisory.json', {
      ...POLICY,
      scopes: { ...POLICY.scopes, full: { break: 100, advisory: 'yes' } },
    });
    expect(() => loadMutationPolicy(path)).toThrow(/boolean "advisory"/);
  });

  it('rejects a non-positive maxFiles', () => {
    const path = policyFile('bad-cap.json', {
      ...POLICY,
      scopes: { ...POLICY.scopes, changed: { break: 85, advisory: false, maxFiles: 0 } },
    });
    expect(() => loadMutationPolicy(path)).toThrow(/"maxFiles"/);
  });

  it('rejects a missing scope', () => {
    const path = policyFile('missing-scope.json', {
      mutableDirectories: DIRS,
      scopes: { curated: POLICY.scopes.curated, changed: POLICY.scopes.changed },
    });
    expect(() => loadMutationPolicy(path)).toThrow(/scope "full"/);
  });

  it('accepts a scope without the optional maxFiles cap', () => {
    const path = policyFile('no-cap.json', {
      ...POLICY,
      scopes: { ...POLICY.scopes, changed: { break: 85, advisory: false } },
    });
    expect(loadMutationPolicy(path).scopes.changed.maxFiles).toBeUndefined();
  });
});
