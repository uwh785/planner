import React from 'react';
import { Appearance } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SessionService } from '@/application/auth/SessionService';
import type { AppContainer, ContainerSource } from '@/application/container';
import App from '@/presentation/App';
import {
  active,
  FakeAuthGateway,
  InMemorySessionStore,
} from './helpers/authFakes';
import { asContainer } from './helpers/plannerWorld';
import { openTestWorld } from './helpers/testRepositories';

async function signedInSession() {
  const session = new SessionService({
    gateway: new FakeAuthGateway(),
    store: new InMemorySessionStore(active()),
    users: { setUser: async () => undefined },
  });
  await session.restore();
  return session;
}

async function fakeSource(
  acquire?: () => Promise<AppContainer>,
): Promise<ContainerSource & { acquire: jest.Mock; release: jest.Mock }> {
  const container = asContainer(await openTestWorld());
  return {
    acquire: jest.fn(acquire ?? (() => Promise.resolve(container))),
    release: jest.fn(),
  };
}

/** Spanish is the default language, so the Panel is titled "Panel". */
const lists = () => screen.findByRole('header', { name: 'Panel' });

let logSpy: jest.SpyInstance;
beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

test('shows the Panel once signed in and the database is open', async () => {
  render(
    <App session={await signedInSession()} containers={await fakeSource()} />,
  );
  expect(await lists()).toBeTruthy();
  expect(screen.queryByText('Planner')).toBeNull();
  expect(await screen.findByText('No hay tareas activas')).toBeTruthy();
});

test('acquires the container once on mount and says Loading until it opens', async () => {
  const source = await fakeSource(() => new Promise(() => undefined));
  render(<App session={await signedInSession()} containers={source} />);
  expect(await screen.findByText('Cargando…')).toBeTruthy();
  expect(source.acquire).toHaveBeenCalledTimes(1);
});

test('logs the schema version once the database is ready', async () => {
  render(
    <App session={await signedInSession()} containers={await fakeSource()} />,
  );
  await lists();
  expect(logSpy).toHaveBeenCalledWith('db ready (schema v2)');
});

test('releases the container on unmount', async () => {
  const source = await fakeSource();
  const view = render(
    <App session={await signedInSession()} containers={source} />,
  );
  await lists();
  expect(source.release).not.toHaveBeenCalled();
  view.unmount();
  expect(source.release).toHaveBeenCalledTimes(1);
});

test('pairs every acquire with a release under StrictMode double effects', async () => {
  // react-native-screens still uses findNodeHandle, which StrictMode flags.
  const error = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (!args.some(arg => String(arg).includes('findNodeHandle'))) {
      error(...args);
    }
  });
  const source = await fakeSource();
  render(
    <React.StrictMode>
      <App session={await signedInSession()} containers={source} />
    </React.StrictMode>,
  );
  await lists();
  expect(source.acquire.mock.calls.length).toBe(
    source.release.mock.calls.length + 1,
  );
});

test('reports a failed open instead of crashing', async () => {
  const errorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  const source = await fakeSource(() => Promise.reject(new Error('disk full')));
  render(<App session={await signedInSession()} containers={source} />);
  expect(await screen.findByText('Cargando…')).toBeTruthy();
  await new Promise(resolve => setImmediate(resolve));
  expect(errorSpy).toHaveBeenCalledWith('db init failed', expect.any(Error));
});

test('renders in dark mode too', async () => {
  jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark');
  render(
    <App session={await signedInSession()} containers={await fakeSource()} />,
  );
  expect(await lists()).toBeTruthy();
  expect(await screen.findByLabelText('Pendientes: 0')).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Tareas' })).toBeTruthy();
});
