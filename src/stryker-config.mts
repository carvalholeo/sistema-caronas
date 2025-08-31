const config = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'jest',
  coverageAnalysis: 'perTest',

  // Files to mutate
  mutate: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/app.ts', // Entry point
    '!src/types/**',
    '!src/scripts/**'
  ],

  // Test files
  testFramework: 'jest',
  jest: {
    projectType: 'custom',
    config: require('./jest.config.js'),
    enableFindRelatedTests: true
  },

  // Timeout settings
  timeoutMS: 60000,
  timeoutFactor: 1.5,

  // Thresholds
  thresholds: {
    high: 80,
    low: 60,
    break: 50
  },

  // Disable mutators that would create infinite loops or break basic functionality
  mutator: {
    excludedMutations: [
      'ArithmeticOperator',
      'ArrayDeclaration',
      'BlockStatement'
    ]
  },

  // Concurrency
  concurrency: 4,
  maxConcurrentTestRunners: 2,

  // Reporting
  htmlReporter: {
    baseDir: 'reports/mutation'
  },

  // Incremental testing
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json'
};

export default config;
