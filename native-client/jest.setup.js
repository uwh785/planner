/* eslint-env jest */
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Async Storage's own in-memory implementation (the native module is absent).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// The native date and time dialogs; tests that need them replace this mock.
jest.mock('@react-native-community/datetimepicker', () => ({
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));

// A hardware back button the tests can press (`BackHandler.mockPressBack()`);
// handlers run last-registered first, like Android.
jest.mock('react-native/Libraries/Utilities/BackHandler', () => {
  const handlers = [];
  return {
    __esModule: true,
    default: {
      addEventListener: (_name, handler) => {
        handlers.unshift(handler);
        return {
          remove: () => {
            const index = handlers.indexOf(handler);
            if (index >= 0) {
              handlers.splice(index, 1);
            }
          },
        };
      },
      exitApp: jest.fn(),
      mockPressBack: () => handlers.some(handler => handler()),
    },
  };
});
