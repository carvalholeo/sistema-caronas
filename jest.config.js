module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  bail: true,
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^models/(.*)$': '<rootDir>/src/models/$1',
    '^routes/(.*)$': '<rootDir>/src/routes/$1',
    '^middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^utils/(.*)$': '<rootDir>/src/utils/$1',
    '^services/(.*)$': '<rootDir>/src/services/$1',
    '^controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^types/(.*)$': '<rootDir>/src/types/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.(ts|js)',
  ]
};