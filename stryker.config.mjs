/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'pnpm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'jest',
  coverageAnalysis: 'perTest',
  plugins: ['@stryker-mutator/jest-runner'],
  tsconfigFile: 'tsconfig.json',
  mutate: [
    './src/features/landing/components/**/*.tsx',
    './src/features/swagger/**/*.tsx',
    '!src/features/landing/components/**/*.stories.tsx',
    '!src/features/landing/components/**/*.stories.ts',
    '!src/features/landing/components/Landing/Landing.tsx',
  ],
  ignorePatterns: ['**/*.stories.tsx', '**/*.stories.ts', 'dist', 'coverage', 'src/test/memory-leak/results/**'],
  thresholds: { high: 100, break: 99 },
};

export default config;
