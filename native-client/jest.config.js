module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Only *.test.* files are tests; __tests__/helpers holds shared suites.
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  // React Navigation ships ES modules; Babel has to transform them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-async-storage|lucide-react-native|react-native-svg|@react-navigation)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Deep icon imports resolve to the CommonJS build under Jest (the
    // package's "react-native" export condition points at ES modules).
    '^lucide-react-native/icons/(.*)$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
  },
};
