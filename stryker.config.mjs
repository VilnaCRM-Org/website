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
  mutate: [
    'src/features/landing/components/AuthSection/Validations/email.ts',
    'src/features/landing/components/AuthSection/Validations/password.ts',
    'src/features/landing/helpers/normalizeLink.ts',
    'src/features/swagger/hooks/useSwagger.ts',
  ],
  // Force-include the gitignored, recipe-generated i18n bundle (#328) so it
  // reaches the sandbox — Stryker's in-process Jest runner bypasses the Jest
  // globalSetup that would otherwise regenerate it, and i18nConfig requires it.
  ignorePatterns: [
    'dist',
    'coverage',
    'src/test/memory-leak/results/**',
    '!pages/i18n/localization.json',
  ],
  thresholds: { high: 100, break: 100 },
};

export default config;
