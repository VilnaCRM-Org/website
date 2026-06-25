import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  clearMocks: true,
  collectCoverage: false,
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  preset: 'ts-jest',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: [
    '<rootDir>/src/test/unit/email-validation.test.ts',
    '<rootDir>/src/test/unit/normalizeLink.test.ts',
    '<rootDir>/src/test/unit/password-validation.test.ts',
    '<rootDir>/src/test/unit/swagger/use-swagger.test.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  modulePathIgnorePatterns: ['<rootDir>/.stryker-tmp/'],
};

export default createJestConfig(config);
