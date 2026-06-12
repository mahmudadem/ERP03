/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts', '**/src/**/*.spec.ts', '**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  // uuid@14 is ESM-only and can't be parsed by ts-jest's CommonJS runtime, which
  // silently breaks every suite that imports a file using it. Map it to a tiny
  // CJS-friendly shim (crypto.randomUUID) for tests only — production keeps real uuid.
  moduleNameMapper: {
    '^uuid$': '<rootDir>/src/tests/shims/uuidShim.ts',
  },
  modulePathIgnorePatterns: ['<rootDir>/lib/'],
};
