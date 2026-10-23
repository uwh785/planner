import { act, fireEvent, screen } from '@testing-library/react-native';
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

async function openAccount() {
  const env = await renderSignedIn();
  fireEvent.press(screen.getByRole('button', { name: 'Account' }));
  await screen.findByRole('header', { name: 'Account' });
  return env;
}

it('shows who is signed in', async () => {
  await openAccount();
  expect(screen.getByText('Ann')).toBeTruthy();
  expect(screen.getByText('a@b.co')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
});

it('goes back to the lists', async () => {
  await renderSignedIn();
  fireEvent.press(screen.getByRole('button', { name: 'Account' }));
  await screen.findByRole('header', { name: 'Account' });
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(await screen.findByRole('header', { name: 'Lists' })).toBeTruthy();
});

it('signs out: keeps local data, releases the database and shows the sign-in form', async () => {
  const env = await openAccount();
  await env.world.tasks.create({ title: 'kept' });
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByText('Welcome back')).toBeTruthy();
  expect(env.containers.release).toHaveBeenCalled();
  expect(await env.world.tasks.count()).toBe(1);
});

it('still shows the sign-in form if signing out fails on the server', async () => {
  const env = await openAccount();
  env.gateway.logout.mockRejectedValueOnce(new Error('offline') as never);
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByText('Welcome back')).toBeTruthy();
});

describe('development items', () => {
  it('queue a sample task in development builds', async () => {
    const env = await openAccount();
    fireEvent.press(
      screen.getByRole('button', { name: 'Add sample task (dev)' }),
    );
    await settle();
    const [task] = await env.world.tasks.list();
    expect(task!.title).toMatch(/^Sample task /);
  });

  it('are absent from release builds', async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    await openAccount();
    expect(screen.queryByRole('button', { name: /sample task/i })).toBeNull();
    expect(screen.queryByText('Development')).toBeNull();
  });

  it('are not on the main flow', async () => {
    await renderSignedIn();
    expect(screen.queryByRole('button', { name: /sample task/i })).toBeNull();
  });
});
