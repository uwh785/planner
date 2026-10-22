import { NotSignedInError } from '@/application/auth/errors';
import type { AppContainer } from '@/application/container';
import { createAppServices } from '@/infrastructure/composition/createAppServices';
import { active, InMemorySessionStore } from '../helpers/authFakes';

jest.mock('@/infrastructure/db/initDatabase', () => ({
  initDatabase: jest.fn(),
}));

const fakeContainer = (): AppContainer =>
  ({ close: jest.fn(async () => undefined) } as never);

const authBody = {
  data: {
    token: 'jwt',
    refresh_token: 'rt',
    user: { user_id: 'usr_7', email: 'a@b.co', name: 'Ann' },
  },
};

afterEach(() => jest.restoreAllMocks());

it('restores a stored session offline and opens that user database', async () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  const open = jest.fn(async (_userId: string) => fakeContainer());
  const services = createAppServices({
    apiBaseUrl: 'http://api.test',
    sessionStore: new InMemorySessionStore(active()),
    openContainer: open,
  });
  await services.ready;
  await services.containers.acquire();
  expect(open).toHaveBeenCalledWith('usr_1');
  expect(fetchSpy).not.toHaveBeenCalled();
});

it('opens the new user database after login and refuses after logout', async () => {
  jest.spyOn(globalThis, 'fetch').mockImplementation((async (url: string) => {
    const done = String(url).endsWith('/logout');
    return {
      status: done ? 204 : 200,
      ok: true,
      text: async () => (done ? '' : JSON.stringify(authBody)),
    };
  }) as never);
  const open = jest.fn(async (_userId: string) => fakeContainer());
  const services = createAppServices({
    apiBaseUrl: 'http://api.test',
    sessionStore: new InMemorySessionStore(),
    openContainer: open,
  });
  await services.ready;
  await expect(services.containers.acquire()).rejects.toBeInstanceOf(
    NotSignedInError,
  );
  services.containers.release();
  await services.session.login({ email: 'a@b.co', password: 'pw' });
  await services.containers.acquire();
  expect(open).toHaveBeenCalledWith('usr_7');
  await services.session.logout();
  await expect(services.containers.acquire()).rejects.toBeInstanceOf(
    NotSignedInError,
  );
});
