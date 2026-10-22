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
