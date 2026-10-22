import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SessionService } from '@/application/auth/SessionService';
import type { AppContainer, ContainerSource } from '@/application/container';
import App from '@/presentation/App';
import {
  active,
  FakeAuthGateway,
  InMemorySessionStore,
} from './helpers/authFakes';

const container = { schemaVersion: 2 } as unknown as AppContainer;

async function signedInSession() {
  const session = new SessionService({
    gateway: new FakeAuthGateway(),
    store: new InMemorySessionStore(active()),
    users: { setUser: async () => undefined },
  });
  await session.restore();
  return session;
}

function fakeSource(
  acquire: () => Promise<AppContainer> = () => Promise.resolve(container),
) {
  return {
    acquire: jest.fn(acquire),
    release: jest.fn(),
  } satisfies ContainerSource;
}

let logSpy: jest.SpyInstance;
beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

test('renders the Planner title once signed in', async () => {
  render(<App session={await signedInSession()} containers={fakeSource()} />);
  expect(await screen.findAllByText('Planner')).toHaveLength(1);
});

test('acquires the container once on mount without blocking the screen', async () => {
  const source = fakeSource(() => new Promise(() => undefined));
  render(<App session={await signedInSession()} containers={source} />);
  expect(await screen.findByText('Planner')).toBeTruthy();
  expect(source.acquire).toHaveBeenCalledTimes(1);
});

test('logs the schema version once the database is ready', async () => {
  render(<App session={await signedInSession()} containers={fakeSource()} />);
  await screen.findByText('Planner');
  await jest.requireActual('react-native').Promise?.resolve();
  expect(logSpy).toHaveBeenCalledWith('db ready (schema v2)');
});

test('releases the container on unmount', async () => {
  const source = fakeSource();
  const view = render(
    <App session={await signedInSession()} containers={source} />,
  );
  await screen.findByText('Planner');
  expect(source.release).not.toHaveBeenCalled();
  view.unmount();
  expect(source.release).toHaveBeenCalledTimes(1);
});

test('pairs every acquire with a release under StrictMode double effects', async () => {
  const source = fakeSource();
  render(
    <React.StrictMode>
      <App session={await signedInSession()} containers={source} />
    </React.StrictMode>,
  );
  await screen.findByText('Planner');
  expect(source.acquire.mock.calls.length).toBe(
    source.release.mock.calls.length + 1,
  );
});

test('reports a failed open instead of crashing', async () => {
  const errorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  const source = fakeSource(() => Promise.reject(new Error('disk full')));
  render(<App session={await signedInSession()} containers={source} />);
  await screen.findByText('Planner');
  await new Promise(resolve => setImmediate(resolve));
  expect(errorSpy).toHaveBeenCalledWith('db init failed', expect.any(Error));
});
