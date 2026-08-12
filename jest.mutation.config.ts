import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

/**
 * The test set Stryker runs against, chosen by `MUTATION_SCOPE` (#345).
 *
 * The `curated` scope mutates four hand-picked files, so it names their four
 * specs directly and stays fast. The `changed` and `full` scopes mutate files
 * chosen at run time, so they need the whole client layer available — a mutant
 * whose only killer lives in a spec Jest was never told to collect would be
 * reported as survived, and the gate would fail for a test that exists.
 * `enableFindRelatedTests` still narrows each mutant's run to the specs that
 * actually import the mutated file.
 */
const CURATED_TESTS = [
  '<rootDir>/src/test/unit/email-validation.test.ts',
  '<rootDir>/src/test/unit/normalizeLink.test.ts',
  '<rootDir>/src/test/unit/password-validation.test.ts',
  '<rootDir>/src/test/unit/swagger/use-swagger.test.ts',
];

const CLIENT_LAYER_TESTS = [
  '<rootDir>/src/test/unit/**/*.test.ts',
  '<rootDir>/src/test/testing-library/**/*.test.tsx',
];

// `?.trim() || 'curated'`, deliberately matching parseScope() in
// scripts/ci/mutation-scope.ts: `make` forwards an overridden-to-nothing
// MUTATION_SCOPE as an empty string, and if these two disagreed about what that
// means the gate would score one file set while the runner collected the tests
// for another. Importing parseScope directly is not possible — Jest's TypeScript
// config loader cannot resolve an extensionless relative import — so the shared
// default is pinned by a test instead (`parseScope treats an empty string as the
// curated default`).
const scope = process.env.MUTATION_SCOPE?.trim() || 'curated';
const testMatch = scope === 'curated' ? CURATED_TESTS : CLIENT_LAYER_TESTS;

const config: Config = {
  clearMocks: true,
  // Generate the gitignored pages/i18n/localization.json (#328) before
  // jest.setup.ts imports the i18n stack that requires it.
  globalSetup: '<rootDir>/jest.global-setup.js',
  collectCoverage: false,
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  preset: 'ts-jest',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch,
  // Stryker runs with `enableFindRelatedTests`, and Jest's dependency crawler —
  // unlike its runtime resolver — does not follow this repo's tsconfig path
  // aliases. A spec that imports its subject as `@landing/...` is therefore
  // invisible to `--findRelatedTests`, so Stryker runs no test for that mutant,
  // Jest exits 0 on an empty run, and the mutant is reported SURVIVED even
  // though a passing assertion for it already exists. Mapping the aliases here
  // makes the crawler agree with the runtime. `@swagger/global` is excluded
  // because it points at a stylesheet, which next/jest already mocks.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@landing/(.*)$': '<rootDir>/src/features/landing/components/$1',
    '^@swagger/(?!global$)(.*)$': '<rootDir>/src/features/swagger/$1',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '<rootDir>/src/test/testing-library/.*\\/utils\\.tsx$',
  ],
  modulePathIgnorePatterns: ['<rootDir>/.stryker-tmp/'],
  // Same transform as jest.config.ts. The curated scope never needed it — four
  // pure-TypeScript specs reach no ESM-only dependency — but the client layer
  // does, and without it the Stryker dry run dies on `Unexpected token 'export'`
  // before a single mutant is generated.
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': [
      'babel-jest',
      { configFile: '<rootDir>/babel-jest.config.js' },
    ],
  },
};

// Async so the ESM-only allow-list survives next/jest's own
// transformIgnorePatterns, exactly as in jest.config.ts.
export default async () => {
  const nextJestConfig = await createJestConfig(config)();
  return {
    ...nextJestConfig,
    transformIgnorePatterns: ['/node_modules/(?!(uuid|@faker-js/faker)/)'],
  };
};
