// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
import jestConfig from './jest.config.js';
import os from 'node:os';
const config = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'jest',
  coverageAnalysis: 'perTest',
  ignoreStatic: true,

  // Files to mutate
  mutate: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/app.ts', // Entry point
    '!src/types/**',
    '!src/scripts/**',
    '!node_modules/**',
    '!dist/**',
    '!tests/**'
  ],

  // Test files
  jest: {
    projectType: 'custom',
    config: jestConfig,
    enableFindRelatedTests: true
  },

  // Timeout settings
  timeoutMS: 60000,
  timeoutFactor: 2.5,

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
  concurrency: Math.ceil(os.cpus().length * 0.75) * 3,

  // Reporting
  htmlReporter: {
    fileName: 'reports/mutation/report.html',
  },

  // Incremental testing
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json'
};
export default config;
