/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'pnpm',
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
  ignorePatterns: ['dist', 'coverage', 'src/test/memory-leak/results/**'],
  thresholds: { high: 99, break: 98 },
};

export default config;
