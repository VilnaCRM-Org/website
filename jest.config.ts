import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const config: Config = {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  testMatch: [
    '<rootDir>/src/features/landing/components/**/*.test.tsx',
    '<rootDir>/src/test/unit/**/*.test.ts',
  ],
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
};

export default createJestConfig(config);
