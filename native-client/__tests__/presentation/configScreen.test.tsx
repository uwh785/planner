import { act, fireEvent, screen } from '@testing-library/react-native';
import { SyncStatus } from '@/application/sync/SyncStatus';
import { flushAsync } from '../helpers/plannerWorld';
import { renderSignedIn } from '../helpers/renderApp';

const settle = () => act(async () => flushAsync());
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  jest.restoreAllMocks();
});

async function openConfig(options: Parameters<typeof renderSignedIn>[0] = {}) {
  const env = await renderSignedIn(options);
  fireEvent.press(
    screen.getByRole('tab', {
      name: options.locale === 'es' ? 'Config' : 'Settings',
    }),
  );
  await screen.findByRole('header', {
    name: options.locale === 'es' ? 'Configuración' : 'Settings',
  });
  return env;
}

it('has the language selector, the Lists entry, the account, sign out and the sync line', async () => {
  await openConfig({ sync: new SyncStatus() });
  expect(screen.getByRole('radio', { name: 'Español' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'English' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Lists/ })).toBeTruthy();
  expect(screen.getByText('Ann')).toBeTruthy();
  expect(screen.getByText('a@b.co')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sign Out' })).toBeTruthy();
  expect(screen.getByText('Not synced yet')).toBeTruthy();
});

it('selects the current language and shows the sync line as a polite live region', async () => {
  const sync = new SyncStatus();
  sync.update({ phase: 'offline', pendingCount: 2 });
  await openConfig({ sync });
  expect(
    screen.getByRole('radio', { name: 'English' }).props.accessibilityState,
  ).toMatchObject({ selected: true });
  expect(
    screen.getByRole('radio', { name: 'Español' }).props.accessibilityState,
  ).toMatchObject({ selected: false });
  expect(
    screen.getByText('Offline. 2 changes waiting.').props
      .accessibilityLiveRegion,
  ).toBe('polite');
});

it('opens list management', async () => {
  await openConfig();
  fireEvent.press(screen.getByRole('button', { name: /^Lists/ }));
  expect(await screen.findByRole('header', { name: 'Lists' })).toBeTruthy();
});

it('signs out: keeps local data, releases the database and shows the sign-in form', async () => {
  const env = await openConfig();
  await env.world.tasks.create({ title: 'kept' });
  fireEvent.press(screen.getByRole('button', { name: 'Sign Out' }));
  expect(await screen.findByRole('header', { name: 'Sign In' })).toBeTruthy();
  expect(env.containers.release).toHaveBeenCalled();
  expect(await env.world.tasks.count()).toBe(1);
});

it('still shows the sign-in form if signing out fails on the server', async () => {
  const env = await openConfig();
  env.gateway.logout.mockRejectedValueOnce(new Error('offline') as never);
  fireEvent.press(screen.getByRole('button', { name: 'Sign Out' }));
  expect(await screen.findByRole('header', { name: 'Sign In' })).toBeTruthy();
});

describe('development items', () => {
  it('queue a sample task in development builds', async () => {
    const env = await openConfig();
    fireEvent.press(
      screen.getByRole('button', { name: 'Add sample task (dev)' }),
    );
    await settle();
    const [task] = await env.world.tasks.list();
    expect(task!.title).toMatch(/^Sample task /);
    expect(screen.getByText('Development')).toBeTruthy();
  });

  it('are absent from release builds', async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    await openConfig();
    expect(screen.queryByRole('button', { name: /sample task/i })).toBeNull();
    expect(screen.queryByText('Development')).toBeNull();
  });

  it('are not on the main flow', async () => {
    await renderSignedIn();
    expect(screen.queryByRole('button', { name: /sample task/i })).toBeNull();
  });
});

it('is in Spanish by default and keeps the web wording', async () => {
  await openConfig({ locale: 'es' });
  expect(screen.getByText('Idioma')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Cerrar Sesión' })).toBeTruthy();
  expect(screen.getAllByRole('radio')).toHaveLength(2);
});
