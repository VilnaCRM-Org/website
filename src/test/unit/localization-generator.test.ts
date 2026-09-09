import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import LocalizationGenerator from '../../../scripts/localizationGenerator';

/**
 * `scripts/localizationGenerator.js` merges every `src/features/<feature>/i18n/*.json`
 * bundle into the gitignored `pages/i18n/localization.json` that `src/config/i18nConfig`
 * requires. It runs from three places (the `next.config.js` webpack hook, the Jest
 * `globalSetup`, and `scripts/generateLocalization.mjs`), so its output is on the critical
 * path of every build, test run and lint pass.
 *
 * Until #335 the only spec for it lived at `scripts/test/unit/localizationGenerator.spec.js`,
 * which no Jest layer's `testMatch` selected — it had silently rotted past the #328 switch
 * from the async `fs.writeFile` to `fs.writeFileSync` and would have failed had anything run
 * it. This file replaces it inside `src/test/unit`, which `make test-unit-client` does run.
 *
 * The suite drives a real temporary feature tree rather than a mocked `fs`, so it asserts the
 * bytes the build actually gets.
 *
 * Not applicable: Permission / auth — a build-time file generator with no authenticated
 * state. Not applicable: Responsive / accessibility — no rendered UI.
 */

interface FeatureTree {
  [featureFolder: string]: {
    [fileName: string]: string;
  };
}

const LANDING_EN = { header: { contacts: 'Contacts' }, hero: { title: 'Vilna' } };
const LANDING_UK = { header: { contacts: 'Контакти' }, hero: { title: 'Вільна' } };
const SWAGGER_EN = { swagger: { title: 'API' } };
const SWAGGER_UK = { swagger: { title: 'АПІ' } };

let workspace: string;

/** Materialise `tree` as real directories/files under a fresh temp workspace. */
function writeFeatureTree(tree: FeatureTree): string {
  const featuresRoot = fs.mkdtempSync(path.join(workspace, 'features-'));

  Object.entries(tree).forEach(([featureFolder, files]) => {
    const i18nDir = path.join(featuresRoot, featureFolder, 'i18n');
    fs.mkdirSync(i18nDir, { recursive: true });

    Object.entries(files).forEach(([fileName, contents]) => {
      fs.writeFileSync(path.join(i18nDir, fileName), contents);
    });
  });

  return featuresRoot;
}

/**
 * Run the generator against `featuresRoot` and return the exact string it would have
 * written, without touching the repository's real `pages/i18n/localization.json`.
 */
function generatedBundle(featuresRoot: string): string {
  const generator = new LocalizationGenerator('i18n', featuresRoot);
  const written: string[] = [];

  jest.spyOn(generator, 'writeLocalizationFile').mockImplementation((fileContent: string) => {
    written.push(fileContent);
  });

  generator.generateLocalizationFile();

  return written.join('');
}

beforeEach(() => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'localization-generator-'));
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(workspace, { recursive: true, force: true });
});

describe('LocalizationGenerator - bundle contents', () => {
  it('merges every feature i18n file into one bundle keyed by language', () => {
    const featuresRoot = writeFeatureTree({
      landing: { 'en.json': JSON.stringify(LANDING_EN), 'uk.json': JSON.stringify(LANDING_UK) },
      swagger: { 'en.json': JSON.stringify(SWAGGER_EN), 'uk.json': JSON.stringify(SWAGGER_UK) },
    });

    expect(JSON.parse(generatedBundle(featuresRoot))).toEqual({
      en: { translation: { ...LANDING_EN, ...SWAGGER_EN } },
      uk: { translation: { ...LANDING_UK, ...SWAGGER_UK } },
    });
  });

  it('deep-merges keys two features contribute to the same namespace', () => {
    const featuresRoot = writeFeatureTree({
      landing: { 'en.json': JSON.stringify({ shared: { fromLanding: 'a' } }) },
      swagger: { 'en.json': JSON.stringify({ shared: { fromSwagger: 'b' } }) },
    });

    expect(JSON.parse(generatedBundle(featuresRoot))).toEqual({
      en: { translation: { shared: { fromLanding: 'a', fromSwagger: 'b' } } },
    });
  });

  it('ignores non-JSON files and nested directories inside an i18n folder', () => {
    const featuresRoot = writeFeatureTree({
      landing: {
        'en.json': JSON.stringify(LANDING_EN),
        '.gitignore': '*',
        'notes.md': '# not a bundle',
      },
    });
    fs.mkdirSync(path.join(featuresRoot, 'landing', 'i18n', 'nested'), { recursive: true });

    expect(JSON.parse(generatedBundle(featuresRoot))).toEqual({
      en: { translation: LANDING_EN },
    });
  });

  it('ignores files sitting directly in the features root', () => {
    const featuresRoot = writeFeatureTree({
      landing: { 'en.json': JSON.stringify(LANDING_EN) },
    });
    fs.writeFileSync(path.join(featuresRoot, 'README.md'), '# features');

    const generator = new LocalizationGenerator('i18n', featuresRoot);

    expect(generator.getFeatureFolders()).toEqual(['landing']);
  });

  it('writes nothing when there is no feature folder at all', () => {
    const featuresRoot = fs.mkdtempSync(path.join(workspace, 'features-'));
    const generator = new LocalizationGenerator('i18n', featuresRoot);
    const writeSpy = jest.spyOn(generator, 'writeLocalizationFile');

    generator.generateLocalizationFile();

    expect(writeSpy).not.toHaveBeenCalled();
  });
});

describe('LocalizationGenerator - reproducible output (#335)', () => {
  it('produces byte-identical output across repeated runs', () => {
    const featuresRoot = writeFeatureTree({
      landing: { 'en.json': JSON.stringify(LANDING_EN), 'uk.json': JSON.stringify(LANDING_UK) },
      swagger: { 'en.json': JSON.stringify(SWAGGER_EN), 'uk.json': JSON.stringify(SWAGGER_UK) },
    });

    expect(generatedBundle(featuresRoot)).toBe(generatedBundle(featuresRoot));
  });

  it('produces the same bytes whatever order the filesystem lists entries in', () => {
    const tree: FeatureTree = {
      // Deliberately not alphabetical relative to each other, and each feature
      // contributes to both languages so folder order is observable in the output.
      alpha: {
        'en.json': JSON.stringify({ shared: { one: 'alpha-en' } }),
        'uk.json': JSON.stringify({ shared: { one: 'alpha-uk' } }),
      },
      beta: {
        'en.json': JSON.stringify({ shared: { two: 'beta-en' } }),
        'uk.json': JSON.stringify({ shared: { two: 'beta-uk' } }),
      },
    };

    const forwardRoot = writeFeatureTree(tree);
    const forward = generatedBundle(forwardRoot);

    // `fs.readdirSync` order is filesystem-dependent (hash order on ext4), so reverse
    // every listing to stand in for a machine that enumerates the tree the other way.
    // The real function is overloaded a dozen ways; alias it to the single signature
    // the generator actually calls so the spy stays readable.
    type ListDirectory = (dirPath: string, options: { withFileTypes: true }) => fs.Dirent[];

    const reversedRoot = writeFeatureTree(tree);
    const realReaddirSync = fs.readdirSync as unknown as ListDirectory;
    const reversedReaddirSync: ListDirectory = (dirPath, options) =>
      realReaddirSync(dirPath, options).reverse();

    jest
      .spyOn(fs, 'readdirSync')
      .mockImplementation(reversedReaddirSync as unknown as typeof fs.readdirSync);

    expect(generatedBundle(reversedRoot)).toBe(forward);
  });
});

describe('LocalizationGenerator.writeLocalizationFile', () => {
  it('creates the parent directory and writes the content synchronously', () => {
    const filePath = path.join(workspace, 'pages', 'i18n', 'localization.json');
    const fileContent = JSON.stringify({ en: { translation: {} } });

    new LocalizationGenerator().writeLocalizationFile(fileContent, filePath);

    expect(fs.readFileSync(filePath, 'utf8')).toBe(fileContent);
  });

  it('propagates a write failure instead of swallowing it', () => {
    const generator = new LocalizationGenerator();
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('File write error');
    });

    expect(() => {
      generator.writeLocalizationFile('{}', path.join(workspace, 'localization.json'));
    }).toThrow('File write error');
  });
});

describe('LocalizationGenerator.deepMerge', () => {
  it('defaults both operands to empty objects', () => {
    expect(new LocalizationGenerator().deepMerge()).toEqual({});
  });

  it('replaces a non-object target branch with the merged source branch', () => {
    expect(
      new LocalizationGenerator().deepMerge({ header: 'plain string' }, { header: { cta: 'Go' } })
    ).toEqual({ header: { cta: 'Go' } });
  });

  it('overwrites arrays and primitives rather than merging them element-wise', () => {
    expect(
      new LocalizationGenerator().deepMerge({ items: ['a', 'b'], count: 1 }, { items: ['c'] })
    ).toEqual({ items: ['c'], count: 1 });
  });

  it('skips prototype-polluting keys', () => {
    const target: Record<string, unknown> = {};

    const merged = new LocalizationGenerator().deepMerge(
      target,
      JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"polluted": true}, "ok": 1}')
    );

    expect(merged).toEqual({ ok: 1 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
