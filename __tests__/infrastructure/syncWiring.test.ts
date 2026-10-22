import type { AppContainer } from '@/application/container';
import { createAppServices } from '@/infrastructure/composition/createAppServices';
import { InMemorySessionStore } from '../helpers/authFakes';
import {
  FakeConnectivity,
  FakeLifecycle,
  FakeTimer,
} from '../helpers/syncFakes';
import { openTestWorld } from '../helpers/testRepositories';

jest.mock('@/infrastructure/db/initDatabase', () => ({
  initDatabase: jest.fn(),
}));

const authBody = {
  data: {
    token: 'jwt',
    refresh_token: 'rt',
    user: { user_id: 'usr_7', email: 'a@b.co', name: 'Ann' },
  },
};

const settle = () => new Promise(resolve => setImmediate(resolve));

afterEach(() => jest.restoreAllMocks());

it('syncs the signed-in user right after sign-in, then after local changes, and stops at logout', async () => {
  const world = await openTestWorld();
  const requests: { method: string; path: string; auth?: string }[] = [];
  jest.spyOn(globalThis, 'fetch').mockImplementation((async (
    url: string,
    init: { method: string; headers: Record<string, string>; body?: string },
  ) => {
    const path = String(url).replace('http://api.test', '');
    requests.push({
      method: init.method,
      path,
      auth: init.headers.Authorization,
    });
    const body = path.startsWith('/api/auth/login')
      ? authBody
      : path.startsWith('/api/sync/push')
      ? {
          data: {
            results: (
              JSON.parse(init.body ?? '{}') as { changes: unknown[] }
            ).changes.map((_c, index) => ({ index, status: 'applied' })),
          },
        }
      : path.startsWith('/api/sync')
      ? { data: { cursor: 1 } }
      : null;
    return {
      status: body === null ? 204 : 200,
      ok: true,
      text: async () => (body === null ? '' : JSON.stringify(body)),
    };
  }) as never);

  const timer = new FakeTimer(world.clock);
  const connectivity = new FakeConnectivity(true);
  const lifecycle = new FakeLifecycle(true);
  const container = {
    ...world,
    schemaVersion: 2,
    close: async () => undefined,
  } as unknown as AppContainer;
  const services = createAppServices({
    apiBaseUrl: 'http://api.test',
    sessionStore: new InMemorySessionStore(),
    openContainer: async () => container,
    syncAdapters: { connectivity, lifecycle, timer },
    syncLog: () => undefined,
  });
  await services.ready;
  services.sync.start();
  await services.sync.idle();
  expect(requests).toEqual([]); // signed out: nothing runs

  await services.session.login({ email: 'a@b.co', password: 'pw' });
  await services.sync.idle();
  await settle();
  const sync = requests.filter(r => r.path.startsWith('/api/sync'));
  expect(sync.map(r => `${r.method} ${r.path}`)).toEqual([
    'GET /api/sync?since=0',
  ]);
  expect(sync[0]!.auth).toBe('Bearer jwt');
  expect(services.sync.getSnapshot().phase).toBe('idle');

  await world.tasks.create({ title: 'offline edit' });
  timer.advance(2000);
  await settle();
  expect(
    requests.some(r => r.method === 'POST' && r.path === '/api/sync/push'),
  ).toBe(true);
  expect(await world.outbox.pendingCount()).toBe(0);

  await services.session.logout();
  await services.sync.idle();
  expect(timer.size).toBe(0);
  expect(connectivity.listeners).toBe(0);
  expect(lifecycle.listeners).toBe(0);
  expect(world.changes.listenerCount).toBe(0);
});
