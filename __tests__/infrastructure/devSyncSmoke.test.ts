import * as Keychain from 'react-native-keychain';
import { runSyncSmoke } from '@/infrastructure/composition/devSyncSmoke';
import { initDatabase } from '@/infrastructure/db/initDatabase';

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
    await runSyncSmoke('http://api.test');
    expect(initDatabase).not.toHaveBeenCalled();
    expect(Keychain.getGenericPassword).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    globals.__DEV__ = dev;
    fetchSpy.mockRestore();
  }
});
