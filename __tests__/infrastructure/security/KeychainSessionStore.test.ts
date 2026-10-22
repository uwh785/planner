import * as Keychain from 'react-native-keychain';
import { KeychainSessionStore } from '@/infrastructure/security/KeychainSessionStore';
import { active } from '../../helpers/authFakes';

jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(),
  getGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));

const k = Keychain as jest.Mocked<typeof Keychain>;

beforeEach(() => jest.clearAllMocks());

it('stores the whole session as one JSON entry under its own service', async () => {
  const store = new KeychainSessionStore('planner.test');
  await store.save(active('acc', 'ref'));
  expect(k.setGenericPassword).toHaveBeenCalledTimes(1);
  const [username, password, options] = k.setGenericPassword.mock.calls[0] as [
    string,
    string,
    Keychain.SetOptions,
  ];
  expect(username).toBe('session');
  expect(JSON.parse(password)).toEqual(active('acc', 'ref'));
  expect(options).toMatchObject({ service: 'planner.test' });
});

it('reads the session back', async () => {
  k.getGenericPassword.mockResolvedValue({
    username: 'session',
    password: JSON.stringify(active('acc', 'ref')),
    service: 'planner.test',
    storage: 'keychain',
  } as never);
  expect(await new KeychainSessionStore('planner.test').get()).toEqual(
    active('acc', 'ref'),
  );
  expect(k.getGenericPassword).toHaveBeenCalledWith({
    service: 'planner.test',
  });
});

it('keeps an expired identity with null tokens', async () => {
  const expired = {
    userId: 'u',
    email: 'e',
    name: 'n',
    accessToken: null,
    refreshToken: null,
  };
  k.getGenericPassword.mockResolvedValue({
    password: JSON.stringify(expired),
  } as never);
  expect(await new KeychainSessionStore().get()).toEqual(expired);
});

it('returns null when nothing is stored', async () => {
  k.getGenericPassword.mockResolvedValue(false);
  expect(await new KeychainSessionStore().get()).toBeNull();
});

it('treats a corrupt entry as signed out', async () => {
  k.getGenericPassword.mockResolvedValue({ password: '{not json' } as never);
  expect(await new KeychainSessionStore().get()).toBeNull();
  k.getGenericPassword.mockResolvedValue({
    password: JSON.stringify({ userId: 1 }),
  } as never);
  expect(await new KeychainSessionStore().get()).toBeNull();
});

it('clears the entry', async () => {
  await new KeychainSessionStore('planner.test').clear();
  expect(k.resetGenericPassword).toHaveBeenCalledWith({
    service: 'planner.test',
  });
});
