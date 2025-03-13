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
  preset: 'ts-jest',
  testEnvironment: process.env.TEST_ENV === 'server' ? 'node' : 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

export default createJestConfig(config);
