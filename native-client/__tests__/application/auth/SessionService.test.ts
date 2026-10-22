import { SessionStoreUnreadableError } from '@/application/auth/errors';
import { SessionService } from '@/application/auth/SessionService';
import {
  active,
  FakeAuthGateway,
  InMemorySessionStore,
} from '../../helpers/authFakes';

function setup(initial = null as ReturnType<typeof active> | null) {
  const store = new InMemorySessionStore(initial);
  const gateway = new FakeAuthGateway();
  const users = { setUser: jest.fn(async (_id: string | null) => undefined) };
  const service = new SessionService({ gateway, store, users });
  return { store, gateway, users, service };
}

it('opens the user database after login and closes it on logout', async () => {
  const { service, users, store } = setup();
  await service.login({ email: 'a@b.co', password: 'pw' });
  expect(users.setUser).toHaveBeenLastCalledWith('usr_1');
  expect(service.current()?.userId).toBe('usr_1');
  await service.logout();
  expect(users.setUser).toHaveBeenLastCalledWith(null);
  expect(store.value).toBeNull();
  expect(service.current()).toBeNull();
});

it('switches the database when another user registers', async () => {
  const { service, users, gateway } = setup();
  await service.login({ email: 'a@b.co', password: 'pw' });
  gateway.register.mockResolvedValue({ ...active(), userId: 'usr_2' });
  await service.register({ email: 'c@d.co', password: 'pw' });
  expect(users.setUser).toHaveBeenLastCalledWith('usr_2');
});

it('restores the stored session offline and opens its database', async () => {
  const { service, users, gateway } = setup(active());
  const restored = await service.restore();
  expect(restored?.userId).toBe('usr_1');
  expect(users.setUser).toHaveBeenCalledWith('usr_1');
  expect(gateway.refresh).not.toHaveBeenCalled();
});

it('keeps local data reachable after the session expired', async () => {
  const expired = {
    userId: 'usr_1',
    email: 'a@b.co',
    name: 'Ann',
    accessToken: null,
    refreshToken: null,
  };
  const { service, users } = setup(expired as never);
  const restored = await service.restore();
  expect(restored).toEqual(expired);
  expect(users.setUser).toHaveBeenCalledWith('usr_1');
});

it('restores nothing when signed out and notifies on expiry', async () => {
  const { service, users } = setup();
  expect(await service.restore()).toBeNull();
  expect(users.setUser).toHaveBeenCalledWith(null);
  const listener = jest.fn();
  const off = service.onSessionExpired(listener);
  service.handleExpired();
  off();
  service.handleExpired();
  expect(listener).toHaveBeenCalledTimes(1);
});

describe('session state', () => {
  const expired = {
    userId: 'usr_1',
    email: 'a@b.co',
    name: 'Ann',
    accessToken: null,
    refreshToken: null,
  };

  it('starts restoring, then reports signed out, signed in or expired', async () => {
    const out = setup();
    expect(out.service.state()).toEqual({ status: 'restoring' });
    await out.service.restore();
    expect(out.service.state()).toEqual({ status: 'signedOut' });

    const signedIn = setup(active());
    await signedIn.service.restore();
    expect(signedIn.service.state()).toEqual({
      status: 'signedIn',
      user: { userId: 'usr_1', email: 'a@b.co', name: 'Ann' },
    });

    const lapsed = setup(expired as never);
    await lapsed.service.restore();
    expect(lapsed.service.state().status).toBe('expired');
  });

  it('reports unreadable (not signed out) when the store cannot be read', async () => {
    const { service, store, users } = setup();
    store.get = async () => {
      throw new SessionStoreUnreadableError();
    };
    expect(await service.restore()).toBeNull();
    expect(service.state()).toEqual({ status: 'unreadable' });
    expect(users.setUser).toHaveBeenLastCalledWith(null);
  });

  it('can retry restoring after an unreadable store', async () => {
    const { service, store } = setup(active());
    const read = store.get.bind(store);
    store.get = async () => {
      throw new SessionStoreUnreadableError();
    };
    await service.restore();
    store.get = read;
    await service.restore();
    expect(service.state().status).toBe('signedIn');
  });

  it('notifies subscribers on every change and stops after unsubscribe', async () => {
    const { service } = setup();
    const listener = jest.fn();
    const off = service.subscribe(listener);
    await service.login({ email: 'a@b.co', password: 'pw' });
    expect(service.state().status).toBe('signedIn');
    service.handleExpired();
    expect(service.state()).toMatchObject({
      status: 'expired',
      user: { userId: 'usr_1' },
    });
    await service.logout();
    expect(service.state()).toEqual({ status: 'signedOut' });
    const calls = listener.mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(3);
    off();
    await service.login({ email: 'a@b.co', password: 'pw' });
    expect(listener).toHaveBeenCalledTimes(calls);
  });

  it('keeps the same snapshot object while nothing changes', async () => {
    const { service } = setup(active());
    await service.restore();
    expect(service.state()).toBe(service.state());
  });
});
