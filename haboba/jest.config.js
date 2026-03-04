module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/backend/'],
  moduleNameMapper: {
    '^react-native-url-polyfill/auto$': '<rootDir>/src/config/__mocks__/urlPolyfill.js',
    '(.*)/config/supabase$': '<rootDir>/src/config/__mocks__/supabase.js',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/*.d.ts',
    '!src/assets/**',
  ],
};
