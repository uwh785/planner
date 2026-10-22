import * as Keychain from 'react-native-keychain';
import { runAuthSmoke } from '@/infrastructure/composition/devAuthSmoke';

jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(),
  getGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));

jest.mock('@/infrastructure/db/initDatabase', () => ({
  initDatabase: jest.fn(),
}));

it('does nothing outside development builds', async () => {
  const globals = globalThis as { __DEV__?: boolean };
  const dev = globals.__DEV__;
  globals.__DEV__ = false;
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  try {
    await runAuthSmoke('http://api.test');
    expect(Keychain.getGenericPassword).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    globals.__DEV__ = dev;
    fetchSpy.mockRestore();
  }
});
