/**
 * Gate en/uk locale parity across every feature's i18n bundle (issue #367).
 *
 * i18next silently falls back to English when a key is missing from `uk.json`, so a
 * translator or developer can add/rename a key in one locale and not the other with no
 * error, no failing test, and no lint warning — Ukrainian users then get mixed-language
 * UI, and when the missing key is an aria string it is an accessibility regression no
 * other gate can see (this spec was added because `swagger/uk.json` shipped without its
 * two `navigation.*` aria strings).
 *
 * The pairs are auto-discovered (`src/features/<feature>/i18n/en.json`) rather than
 * hardcoded, so a new feature with an `en.json` is gated automatically and the empty
 * i18n dirs (registration/documentation/example) are skipped until they gain an `en.json`.
 */
import fs from 'node:fs';
import path from 'node:path';

const FEATURES_DIR = path.resolve(__dirname, '..', '..', 'features');

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

function flattenKeys(value: JsonValue, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

function readKeys(filePath: string): string[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonObject;
  return flattenKeys(parsed).sort();
}

const enFiles = fs
  .readdirSync(FEATURES_DIR)
  .map(feature => path.join(FEATURES_DIR, feature, 'i18n', 'en.json'))
  .filter(enPath => fs.existsSync(enPath));

describe('i18n en/uk locale parity', () => {
  it('discovers at least one feature locale pair', () => {
    expect(enFiles.length).toBeGreaterThan(0);
  });

  describe.each(enFiles)('%s', enPath => {
    const ukPath = enPath.replace(/en\.json$/, 'uk.json');

    it('has a matching uk.json', () => {
      expect(fs.existsSync(ukPath)).toBe(true);
    });

    it('uk.json has exactly the same keys as en.json', () => {
      const enKeys = readKeys(enPath);
      const ukKeys = readKeys(ukPath);

      const missingInUk = enKeys.filter(key => !ukKeys.includes(key));
      const missingInEn = ukKeys.filter(key => !enKeys.includes(key));

      expect({ missingInUk, missingInEn }).toEqual({ missingInUk: [], missingInEn: [] });
    });
  });
});
