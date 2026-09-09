/**
 * `scripts/verifyUiToolkit.mjs` — the only local evidence that the bytes behind
 * the pinned `@vilnacrm/ui-toolkit` release URL are the bytes that were
 * reviewed. bun records no `sha512` for a remote-tarball dependency and
 * osv-scanner cannot key one, so if this gate can be made to pass while lying,
 * nothing else in the repository would notice.
 *
 * Every case therefore drives a FAILURE path: a gate that only proves it passes
 * on the happy tree proves nothing.
 */
import {
  ALGORITHM,
  CHECKSUMS_PATH,
  buildChecksumsFile,
  digest,
  installedVersion,
  listBuildFiles,
  main,
  pinnedVersion,
  readChecksums,
  verify,
} from '../../../../scripts/verifyUiToolkit.mjs';

const TARBALL_URL: string =
  'https://github.com/VilnaCRM-Org/ui-toolkit/releases/download/v9.9.9/vilnacrm-ui-toolkit-9.9.9.tgz';
const ARTIFACT: string = 'build/ui-button.mjs';
const CONTENT: string = 'toolkit bytes';
const CONTENT_DIGEST: string = digest(CONTENT);

type Files = Record<string, string>;

/**
 * The install tree the fake reads. `readDir` mirrors it so the "extra file"
 * check has something to disagree with, which is the branch a digest map alone
 * cannot cover.
 */
function fakeReadDir(files: Files) {
  return (dir: string): { name: string; isDirectory: () => boolean }[] => {
    const prefix = `${dir.replace(`${'node_modules/@vilnacrm/ui-toolkit'}/`, '')}/`;
    const names = new Set<string>();
    Object.keys(files)
      .map(path => path.replace('node_modules/@vilnacrm/ui-toolkit/', ''))
      .filter(path => path.startsWith(prefix))
      .forEach(path => names.add(path.slice(prefix.length).split('/')[0] as string));
    return [...names].map(name => ({
      name,
      isDirectory: () => !name.includes('.'),
    }));
  };
}

function fakeReadFile(files: Files) {
  return (path: string): string => {
    if (!(path in files)) throw new Error(`ENOENT: ${path}`);
    return files[path] as string;
  };
}

function tree(overrides: Files = {}): Files {
  return {
    [CHECKSUMS_PATH]: JSON.stringify({
      algorithm: ALGORITHM,
      version: '9.9.9',
      tarballUrl: TARBALL_URL,
      artifacts: { [ARTIFACT]: CONTENT_DIGEST },
    }),
    'package.json': JSON.stringify({ dependencies: { '@vilnacrm/ui-toolkit': TARBALL_URL } }),
    'node_modules/@vilnacrm/ui-toolkit/package.json': JSON.stringify({ version: '9.9.9' }),
    [`node_modules/@vilnacrm/ui-toolkit/${ARTIFACT}`]: CONTENT,
    ...overrides,
  };
}

describe('ui-toolkit integrity gate', () => {
  it('passes only when every digest, the pin and the installed version agree', () => {
    expect(verify(fakeReadFile(tree()), fakeReadDir(tree()))).toEqual([]);
  });

  it('covers the subpath entry the application actually loads, not just the barrel', () => {
    // Regression guard for the gap the FR/NFR gate found: every seam imports
    // `@vilnacrm/ui-toolkit/<component>`, which resolves to `build/<name>.mjs`
    // and pulls from `build/chunks/*` — `build/index.mjs` is never loaded. A
    // digest set covering only the barrel verified code the site never runs.
    const files: Files = tree({
      [`node_modules/@vilnacrm/ui-toolkit/${ARTIFACT}`]: 'tampered subpath',
    });

    expect(verify(fakeReadFile(files), fakeReadDir(files))).toEqual([
      expect.stringContaining(ARTIFACT),
    ]);
  });

  it('rejects a file added to the install that no digest accounts for', () => {
    const files: Files = tree({
      'node_modules/@vilnacrm/ui-toolkit/build/evil.mjs': 'payload',
    });

    expect(verify(fakeReadFile(files), fakeReadDir(files))).toEqual([
      expect.stringContaining('present in the install but absent'),
    ]);
  });

  it('fails closed when the build directory cannot be listed at all', () => {
    // The artifact SET is half the guarantee: without it an added module goes
    // unnoticed. If the listing itself fails the gate must say so, not fall
    // through having checked only the digests it already knew about.
    const unreadable = (): never => {
      throw new Error('EACCES');
    };

    expect(verify(fakeReadFile(tree()), unreadable)).toEqual([
      expect.stringContaining('build is unreadable'),
    ]);
  });

  it('fails when the recorded tarball URL drifts from the manifest pin', () => {
    const files: Files = tree({
      [CHECKSUMS_PATH]: JSON.stringify({
        algorithm: ALGORITHM,
        version: '9.9.9',
        tarballUrl: 'https://example.invalid/other.tgz',
        artifacts: { [ARTIFACT]: CONTENT_DIGEST },
      }),
    });

    expect(verify(fakeReadFile(files), fakeReadDir(files))).toEqual([
      expect.stringContaining('tarballUrl does not match'),
    ]);
  });

  it('lists every shipped build file, walking nested directories', () => {
    const files: Files = tree({
      'node_modules/@vilnacrm/ui-toolkit/build/chunks/chunk-a.mjs': 'chunk',
    });

    expect(listBuildFiles(fakeReadDir(files))).toEqual(
      expect.arrayContaining([ARTIFACT, 'build/chunks/chunk-a.mjs'])
    );
  });

  it('fails when an installed artifact does not match its committed digest', () => {
    const failures: string[] = verify(
      fakeReadFile(tree({ [`node_modules/@vilnacrm/ui-toolkit/${ARTIFACT}`]: 'tampered' })),
      fakeReadDir(tree())
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(ARTIFACT);
    expect(failures[0]).toContain('does not match committed');
  });

  it('fails when a committed artifact is absent from the installed package', () => {
    const files: Files = tree();
    delete files[`node_modules/@vilnacrm/ui-toolkit/${ARTIFACT}`];

    expect(verify(fakeReadFile(files), fakeReadDir(files))).toEqual([
      expect.stringContaining('missing from the installed package'),
    ]);
  });

  it('fails loudly when the package is not installed rather than reporting success', () => {
    const files: Files = tree();
    delete files['node_modules/@vilnacrm/ui-toolkit/package.json'];

    expect(verify(fakeReadFile(files), fakeReadDir(files))).toEqual([
      expect.stringContaining('is not installed'),
    ]);
  });

  it('fails when the installed version is not the version the manifest pins', () => {
    const files: Files = tree({
      'node_modules/@vilnacrm/ui-toolkit/package.json': JSON.stringify({ version: '0.0.1' }),
    });

    expect(verify(fakeReadFile(files), fakeReadDir(files))).toEqual([
      expect.stringContaining('installed @vilnacrm/ui-toolkit is 0.0.1'),
    ]);
  });

  it('fails when the digest file records a different version from the pin', () => {
    const files: Files = tree({
      [CHECKSUMS_PATH]: JSON.stringify({
        algorithm: ALGORITHM,
        version: '1.2.3',
        tarballUrl: TARBALL_URL,
        artifacts: { [ARTIFACT]: CONTENT_DIGEST },
      }),
    });

    expect(verify(fakeReadFile(files), fakeReadDir(files))).toEqual([
      expect.stringContaining('records version 1.2.3, manifest pins 9.9.9'),
    ]);
  });

  it('refuses an unsupported digest algorithm instead of trusting it', () => {
    const files: Files = tree({
      [CHECKSUMS_PATH]: JSON.stringify({ algorithm: 'md5', version: '9.9.9', artifacts: {} }),
    });

    expect(() => readChecksums(fakeReadFile(files))).toThrow(/unsupported algorithm md5/);
  });

  it('refuses a digest file that declares no artifacts, which would verify nothing', () => {
    const files: Files = tree({
      [CHECKSUMS_PATH]: JSON.stringify({ algorithm: ALGORITHM, version: '9.9.9', artifacts: {} }),
    });

    expect(() => readChecksums(fakeReadFile(files))).toThrow(/verify nothing/);
  });

  it('refuses a manifest whose pin is not an immutable release-tarball URL', () => {
    const files: Files = tree({
      'package.json': JSON.stringify({
        dependencies: { '@vilnacrm/ui-toolkit': 'github:VilnaCRM-Org/ui-toolkit#main' },
      }),
    });

    expect(() => pinnedVersion(fakeReadFile(files))).toThrow(/release-tarball URL/);
  });

  it('refuses a manifest that does not declare the dependency at all', () => {
    const files: Files = tree({ 'package.json': JSON.stringify({ dependencies: {} }) });

    expect(() => pinnedVersion(fakeReadFile(files))).toThrow(/not a dependency/);
  });

  it('reads the installed version from the package it actually verifies', () => {
    expect(installedVersion(fakeReadFile(tree()))).toBe('9.9.9');
  });

  it('rebuilds the digest file from the installed tree, carrying the pin forward', () => {
    const files: Files = tree({
      [`node_modules/@vilnacrm/ui-toolkit/${ARTIFACT}`]: 'new bytes',
    });
    const rebuilt = buildChecksumsFile(fakeReadFile(files), fakeReadDir(files));

    expect(rebuilt.version).toBe('9.9.9');
    expect(rebuilt.artifacts[ARTIFACT]).toBe(digest('new bytes'));
  });

  describe('command-line behaviour', () => {
    it('reports OK and exits zero when the tree verifies', () => {
      const out: string[] = [];
      const err: string[] = [];

      const code: number = main({
        readFile: fakeReadFile(tree()),
        readDir: fakeReadDir(tree()),
        stdout: t => out.push(t),
        stderr: t => err.push(t),
      });

      expect(code).toBe(0);
      expect(out.join('')).toContain('OK (v9.9.9, 1 artifacts verified)');
      expect(err).toEqual([]);
    });

    it('exits non-zero and names every failure, not just the first', () => {
      const out: string[] = [];
      const err: string[] = [];
      const files: Files = tree({
        [`node_modules/@vilnacrm/ui-toolkit/${ARTIFACT}`]: 'tampered',
        'node_modules/@vilnacrm/ui-toolkit/package.json': JSON.stringify({ version: '0.0.1' }),
      });

      const code: number = main({
        readFile: fakeReadFile(files),
        readDir: fakeReadDir(files),
        stdout: t => out.push(t),
        stderr: t => err.push(t),
      });

      expect(code).toBe(1);
      expect(err.join('')).toContain('installed @vilnacrm/ui-toolkit is 0.0.1');
      expect(err.join('')).toContain('does not match committed');
      expect(out).toEqual([]);
    });

    it('exits non-zero when the digest file itself cannot be trusted', () => {
      const err: string[] = [];
      const files: Files = tree({
        [CHECKSUMS_PATH]: JSON.stringify({ algorithm: 'md5', version: '9.9.9', artifacts: {} }),
      });

      const code: number = main({
        readFile: fakeReadFile(files),
        readDir: fakeReadDir(files),
        stdout: () => undefined,
        stderr: t => err.push(t),
      });

      expect(code).toBe(1);
      expect(err.join('')).toContain('unsupported algorithm md5');
    });
  });
});
