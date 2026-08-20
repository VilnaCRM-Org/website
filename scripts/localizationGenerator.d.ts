// Declaration shim for the sibling CommonJS script `localizationGenerator.js`,
// which stays plain JavaScript because `next.config.js` requires it from inside the
// webpack hook and `scripts/generateLocalization.mjs` runs it directly under Node,
// with no build step in either path. Types let
// src/test/unit/localization-generator.test.ts import it under `allowJs: false`,
// mirroring the shims beside `fetchGraphqlSchema.mjs` and `fetchSwaggerSchema.mjs`.
//
// The runtime module is `module.exports = LocalizationGenerator`; `export default`
// is the shape `esModuleInterop` synthesises for that, so a default import resolves
// to the class at both type level and run time.

declare class LocalizationGenerator {
  constructor(
    i18nPath?: string,
    featurePath?: string,
    jsonFileType?: string,
    localizationFile?: string
  );

  /** Merges every feature's i18n bundle and writes `pages/i18n/localization.json`. */
  generateLocalizationFile(): void;

  /** Feature directory names, sorted by UTF-16 code units for reproducible merges. */
  getFeatureFolders(): string[];

  /** Parsed `{ [language]: { translation } }` for one feature, sorted by file name. */
  getLocalizationFromFolder(
    folder: string
  ): Record<string, { translation: Record<string, unknown> }>;

  /** Creates the parent directory and writes `fileContent` synchronously. */
  writeLocalizationFile(fileContent: string, filePath: string): void;

  /** Recursively merges `source` into `target`, skipping prototype-polluting keys. */
  deepMerge(
    target?: Record<string, unknown>,
    source?: Record<string, unknown>
  ): Record<string, unknown>;
}

export default LocalizationGenerator;
