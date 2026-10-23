module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Only *.test.* files are tests; __tests__/helpers holds shared suites.
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  // React Navigation ships ES modules; Babel has to transform them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
