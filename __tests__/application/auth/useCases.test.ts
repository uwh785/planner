import {
  InvalidCredentialsError,
  NetworkError,
} from '@/application/auth/errors';
import {
  login,
  logout,
  register,
  restoreSession,
} from '@/application/auth/useCases';
import { ValidationError } from '@/domain/validation';
import {
  active,
  FakeAuthGateway,
  InMemorySessionStore,
} from '../../helpers/authFakes';

function setup() {
  const gateway = new FakeAuthGateway();
  const store = new InMemorySessionStore();
  return { gateway, store, deps: { gateway, store } };
}

describe('register and login', () => {
  it('validates the basics client-side and sends nothing', async () => {
    const { gateway, deps } = setup();
    await expect(
      register(deps, { email: ' ', password: 'x', name: '' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      login(deps, { email: 'a@b.co', password: '' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(gateway.register).not.toHaveBeenCalled();
    expect(gateway.login).not.toHaveBeenCalled();
  });

  it('persists the session returned by the server', async () => {
    const { gateway, store, deps } = setup();
    gateway.login.mockResolvedValue(active('acc', 'ref'));
    const session = await login(deps, { email: ' a@b.co ', password: 'pw' });
    expect(gateway.login).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'pw',
    });
    expect(store.value).toEqual(session);
    expect(session.refreshToken).toBe('ref');
  });

  it('registers with an optional name and stores the session', async () => {
    const { gateway, store, deps } = setup();
    await register(deps, { email: 'a@b.co', password: 'pw', name: ' Ann ' });
    expect(gateway.register).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'pw',
      name: 'Ann',
    });
    expect(store.value?.userId).toBe('usr_1');
  });

  it('stores nothing when the credentials are refused', async () => {
    const { gateway, store, deps } = setup();
    gateway.login.mockRejectedValue(new InvalidCredentialsError());
    await expect(
      login(deps, { email: 'a@b.co', password: 'bad' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(store.value).toBeNull();
  });
});

describe('logout', () => {
  it('revokes the refresh token and clears secure storage', async () => {
    const { gateway, store, deps } = setup();
    store.value = active('acc', 'ref');
    await logout(deps);
    expect(gateway.logout).toHaveBeenCalledWith('ref', expect.anything());
    expect(store.value).toBeNull();
  });

  it('clears secure storage even when the server call fails', async () => {
    const { gateway, store, deps } = setup();
    store.value = active();
    gateway.logout.mockRejectedValue(new NetworkError('offline'));
    await expect(logout(deps)).resolves.toBeUndefined();
    expect(store.value).toBeNull();
  });

  it('gives up on a hanging server call after the timeout', async () => {
    jest.useFakeTimers();
    try {
      const { gateway, store, deps } = setup();
      store.value = active();
      gateway.logout.mockImplementation(
        (_token: string, signal?: AbortSignal) =>
          new Promise<void>((_, reject) =>
            signal?.addEventListener('abort', () =>
              reject(new NetworkError('aborted')),
            ),
          ),
      );
      const done = logout({ ...deps, serverTimeoutMs: 2000 });
      await jest.advanceTimersByTimeAsync(2000);
      await done;
      expect(store.value).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('skips the server when only an expired identity is stored', async () => {
    const { gateway, store, deps } = setup();
    store.value = {
      userId: 'u',
      email: 'e',
      name: 'n',
      accessToken: null,
      refreshToken: null,
    };
    await logout(deps);
    expect(gateway.logout).not.toHaveBeenCalled();
    expect(store.value).toBeNull();
  });
});

describe('restoreSession', () => {
  it('reads the stored session without touching the network', async () => {
    const { gateway, store } = setup();
    store.value = active();
    expect(await restoreSession({ store })).toEqual(active());
    expect(gateway.refresh).not.toHaveBeenCalled();
  });

  it('returns null when nothing is stored', async () => {
    expect(
      await restoreSession({ store: new InMemorySessionStore() }),
    ).toBeNull();
  });
});
