/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  roots: [
    "./src/test/unit"
  ],
};

// module.exports = {
//   clearMocks: true,
//   collectCoverage: true,
//   coverageDirectory: "coverage",
//   roots: [
//     "./src/test/unit"
//   ],
// };
