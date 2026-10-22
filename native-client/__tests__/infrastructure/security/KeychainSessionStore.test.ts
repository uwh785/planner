import * as Keychain from 'react-native-keychain';
import { KeychainSessionStore } from '@/infrastructure/security/KeychainSessionStore';
import { SessionStoreUnreadableError } from '@/application/auth/errors';
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

describe('corrupt entries', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('treats unparsable and schema-mismatched entries as absent without deleting them', async () => {
    k.getGenericPassword.mockResolvedValue({
      password: '{not json secret-token',
    } as never);
    expect(await new KeychainSessionStore().get()).toBeNull();
    k.getGenericPassword.mockResolvedValue({
      password: JSON.stringify({ userId: 1, refreshToken: 'secret-refresh' }),
    } as never);
    expect(await new KeychainSessionStore().get()).toBeNull();
    expect(k.resetGenericPassword).not.toHaveBeenCalled();
  });

  it('logs only a reason code, never the entry', async () => {
    k.getGenericPassword.mockResolvedValue({
      password: JSON.stringify({ userId: 1, refreshToken: 'secret-refresh' }),
    } as never);
    await new KeychainSessionStore().get();
    k.getGenericPassword.mockResolvedValue({
      password: 'secret-{bad',
    } as never);
    await new KeychainSessionStore().get();
    const logged = JSON.stringify(warn.mock.calls);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(logged).toContain('session_schema_mismatch');
    expect(logged).toContain('session_not_json');
    expect(logged).not.toContain('secret');
  });
});

it('throws SessionStoreUnreadableError when the Keystore read fails', async () => {
  k.getGenericPassword.mockRejectedValue(new Error('Keystore: secret-detail'));
  const failure = await new KeychainSessionStore().get().catch(e => e);
  expect(failure).toBeInstanceOf(SessionStoreUnreadableError);
  expect(String(failure.message)).not.toContain('secret-detail');
});

it('clears the entry', async () => {
  await new KeychainSessionStore('planner.test').clear();
  expect(k.resetGenericPassword).toHaveBeenCalledWith({
    service: 'planner.test',
  });
});
