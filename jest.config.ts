import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

/**
 * Test layers are selected through the `TEST_ENV` environment variable so a
 * single Jest config can drive every Jest-based suite:
 *
 * - `client`      (default) — component tests (jsdom) + pure unit tests.
 * - `server`               — Apollo server tests (Node) + pure unit tests.
 * - `integration`          — the cross-module / API-boundary layer that lives
 *                            in `tests/integration/**`.
 *
 * The integration layer is intentionally isolated from the unit globs: it is
 * the "missing middle" between unit and e2e and must not silently absorb unit
 * tests dropped into a new folder.
 */
const TEST_ENV = process.env.TEST_ENV ?? 'client';

const UNIT_GLOB = '<rootDir>/src/test/unit/**/*.test.ts';
const INTEGRATION_GLOB = '<rootDir>/tests/integration/**/*.integration.test.{ts,tsx}';

const testMatchByEnv: Record<string, string[]> = {
  server: ['<rootDir>/src/test/apollo-server**/*.test.ts', UNIT_GLOB],
  integration: [INTEGRATION_GLOB],
  client: ['<rootDir>/src/test/testing-library**/*.test.tsx', UNIT_GLOB],
};

// Fail fast on an unrecognised TEST_ENV (e.g. a typo in a CI job) instead of
// silently falling back to the client layer and running the wrong suite.
if (!(TEST_ENV in testMatchByEnv)) {
  const supported = Object.keys(testMatchByEnv).join(', ');
  throw new Error(`Unsupported TEST_ENV: "${TEST_ENV}". Expected one of: ${supported}.`);
}

const isIntegration = TEST_ENV === 'integration';
const isServer = TEST_ENV === 'server';

// jsdom lacks the Fetch API; the integration layer drives the real Apollo
// HttpLink, so it runs in a jsdom variant that injects Node's fetch globals.
// Node-environment integration files opt out via an `@jest-environment node`
// docblock.
const INTEGRATION_ENVIRONMENT = '<rootDir>/tests/integration/jsdom-fetch.environment.js';

// The integration layer mirrors CRM: it collects coverage across the whole
// product source and enforces a global 100% threshold, so the integration
// suite alone must exercise every shipped module. Client/server runs keep their
// existing (default-scope) coverage behaviour untouched.
const INTEGRATION_COVERAGE_FROM = [
  '<rootDir>/src/**/*.{ts,tsx}',
  '!<rootDir>/src/**/types/**',
  '!<rootDir>/src/**/types.ts',
  '!<rootDir>/src/**/theme.ts',
  '!<rootDir>/src/**/styles/**',
  '!<rootDir>/src/**/*.d.ts',
  '!<rootDir>/src/**/*.stories.{ts,tsx}',
  '!<rootDir>/src/**/*.test.{ts,tsx}',
  '!<rootDir>/src/**/__mocks__/**',
  '!<rootDir>/src/**/__fixtures__/**',
  '!<rootDir>/src/test/**',
];

const INTEGRATION_COVERAGE_THRESHOLD = {
  global: { branches: 100, functions: 100, lines: 100, statements: 100 },
};

const config: Config = {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  // The integration layer uses the `babel` coverage provider so coverage is
  // instrumented on the same babel-jest-transformed output the tests run
  // against; this keeps the strict 100% threshold measured against the exact
  // executed code. `v8` instruments native output and remaps via source maps,
  // which can shift branch/line attribution and destabilise the 100% gate.
  coverageProvider: isIntegration ? 'babel' : 'v8',
  ...(isIntegration
    ? {
        collectCoverageFrom: INTEGRATION_COVERAGE_FROM,
        coverageThreshold: INTEGRATION_COVERAGE_THRESHOLD,
      }
    : {}),
  testMatch: testMatchByEnv[TEST_ENV],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '<rootDir>/src/test/testing-library/.*\\/utils\\.tsx$',
  ],
  preset: 'ts-jest',
  testEnvironment: isServer ? 'node' : isIntegration ? INTEGRATION_ENVIRONMENT : 'jsdom',
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': [
      'babel-jest',
      { configFile: '<rootDir>/babel-jest.config.js' },
    ],
  },
  setupFilesAfterEnv: isIntegration
    ? ['<rootDir>/jest.setup.ts', '<rootDir>/tests/integration/setup.ts']
    : ['<rootDir>/jest.setup.ts'],
  modulePathIgnorePatterns: ['<rootDir>/.stryker-tmp/'],
};

// Use async config to properly merge transformIgnorePatterns
export default async () => {
  const nextJestConfig = await createJestConfig(config)();
  return {
    ...nextJestConfig,
    transformIgnorePatterns: [
      // Allow transforming ESM packages from pnpm's .pnpm folder
      '/node_modules/.pnpm/(?!(uuid|@faker-js\\+faker)@)',
    ],
  };
};
