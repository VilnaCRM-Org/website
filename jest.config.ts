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
 *                            in `tests/integration/**` (see tests/integration/README.md).
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

const isIntegration = TEST_ENV === 'integration';
const isServer = TEST_ENV === 'server';

// jsdom lacks the Fetch API; the integration layer drives the real Apollo
// HttpLink, so it runs in a jsdom variant that injects Node's fetch globals.
// Node-environment integration files opt out via an `@jest-environment node`
// docblock.
const INTEGRATION_ENVIRONMENT = '<rootDir>/tests/integration/jsdom-fetch.environment.js';

const config: Config = {
  clearMocks: true,
  collectCoverage: !isIntegration,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  testMatch: testMatchByEnv[TEST_ENV] ?? testMatchByEnv.client,
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
