module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  // Edge Function tests run under Deno (`deno test`), not Jest. They
  // import from `https://deno.land/...`, which Jest's Node resolver
  // can't see and shouldn't try to. Keep them out of the Jest run.
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/backend/', '/supabase/functions/'],
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
