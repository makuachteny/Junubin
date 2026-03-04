module.exports = {
  testTimeout: 180000,
  maxWorkers: 1,
  testRunner: 'jest-circus/runner',
  testMatch: ['<rootDir>/**/*.e2e.js'],
  setupFilesAfterEnv: ['<rootDir>/init.js'],
  reporters: ['detox/runners/jest/reporter'],
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
};
