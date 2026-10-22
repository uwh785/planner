import { bootstrapApp } from '@/infrastructure/composition/bootstrapApp';
import { InMemorySessionStore } from '../helpers/authFakes';

jest.mock('@/infrastructure/db/initDatabase', () => ({
  initDatabase: jest.fn(),
}));

afterEach(() => jest.restoreAllMocks());

it('returns the services when the build is configured', async () => {
  const boot = bootstrapApp({
    apiBaseUrl: 'http://api.test',
    sessionStore: new InMemorySessionStore(),
  });
  expect(boot.kind).toBe('ready');
  if (boot.kind === 'ready') {
    await boot.services.ready;
    expect(boot.services.session.state().status).toBe('signedOut');
  }
});

it('turns a missing release API URL into a handled fatal state, not a throw', () => {
  const errorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  try {
    const boot = bootstrapApp({ sessionStore: new InMemorySessionStore() });
    expect(boot.kind).toBe('fatal');
    if (boot.kind === 'fatal') {
      expect(boot.message).toMatch(/not set up correctly/i);
      expect(boot.message).not.toMatch(/RELEASE_API_BASE_URL|https?:\/\//);
    }
    expect(errorSpy).toHaveBeenCalled();
  } finally {
    (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
  }
});
