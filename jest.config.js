module.exports = {
  preset: 'ts-jest',
  bail: false,
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/app.ts',
    '!src/**/server.ts',
    '!**/node_modules/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+.(ts|tsx)': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  moduleNameMapper: {
    '^models/(.*)': "<rootDir>/src/models/$1",
    '^routes/(.*)': '<rootDir>/src/routes/$1',
    '^middlewares/(.*)': '<rootDir>/src/middlewares/$1',
    '^providers/(.*)': '<rootDir>/src/providers/$1',
    '^services/(.*)': '<rootDir>/src/services/$1',
    '^types/(.*)': '<rootDir>/src/types/$1',
    '^utils/(.*)': '<rootDir>/src/utils/$1',
    '^config/(.*)': '<rootDir>/src/config/$1',
  },
};