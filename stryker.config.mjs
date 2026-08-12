import { readFileSync } from 'node:fs';

// The break threshold lives in config/mutation-policy.json alongside the
// changed-files and nightly scopes (#345), so no scope can drift from another.
// Read rather than imported: an import attribute would tie this config to a
// specific Node JSON-module syntax for no gain.
const policy = JSON.parse(
  readFileSync(new URL('./config/mutation-policy.json', import.meta.url), 'utf8')
);

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text'],
  testRunner: 'jest',
  coverageAnalysis: 'off',
  plugins: ['@stryker-mutator/jest-runner'],
  tsconfigFile: 'tsconfig.json',
  jest: {
    configFile: 'jest.mutation.config.ts',
    enableFindRelatedTests: true,
  },
  // The curated scope: the files held at a 100% mutation score. The kebab-case
  // paths matter — the pre-#225 `AuthSection/Validations/` spellings silently
  // mutated nothing after the rename, because Stryker treats a `mutate` entry
  // that matches no file as an empty set rather than an error.
  mutate: [
    'src/features/landing/components/auth-section/validations/email.ts',
    'src/features/landing/components/auth-section/validations/password.ts',
    'src/features/landing/helpers/normalizeLink.ts',
    'src/features/swagger/hooks/useSwagger.ts',
  ],
  // Force-include the gitignored, recipe-generated i18n bundle (#328) so it
  // reaches the sandbox — Stryker's in-process Jest runner bypasses the Jest
  // globalSetup that would otherwise regenerate it, and i18nConfig requires it.
  ignorePatterns: [
    'dist',
    'coverage',
    'reports/mutation/**',
    'src/test/memory-leak/results/**',
    '!pages/i18n/localization.json',
  ],
  thresholds: { high: 100, break: policy.scopes.curated.break },
};

export default config;
