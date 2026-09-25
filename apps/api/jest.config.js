/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  // src/config/env.ts validates required variables at import time; give the
  // unit tests safe placeholders so they don't depend on a developer's .env.
  setupFiles: ["<rootDir>/jest.setup.js"],
};
