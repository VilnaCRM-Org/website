import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  testMatch: [
    process.env.TEST_ENV === 'server'
      ? '<rootDir>/src/test/apollo-server**/*.test.ts'
      : '<rootDir>/src/test/testing-library**/*.test.tsx',
    '<rootDir>/src/test/unit/**/*.test.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '<rootDir>/src/test/testing-library/.*\\/utils\\.tsx$',
  ],
  preset: 'ts-jest',
  testEnvironment: process.env.TEST_ENV === 'server' ? 'node' : 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  modulePathIgnorePatterns: ['<rootDir>/.stryker-tmp/'],
  moduleNameMapper: {
    '^@faker-js/faker$': '<rootDir>/src/test/__mocks__/faker.ts',
  },
};

export default createJestConfig(config);
