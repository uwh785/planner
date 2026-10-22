import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '@/presentation/App';
import type { AppContainer, ContainerSource } from '@/application/container';

const container = { schemaVersion: 2 } as unknown as AppContainer;

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
afterEach(() => {
  jest.restoreAllMocks();
});

test('renders the Planner title', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App containers={fakeSource()} />);
  });
  const titles = renderer.root
    .findAllByType(Text)
    .filter(node => node.props.children === 'Planner');
  expect(titles).toHaveLength(1);
});

test('acquires the container once on mount without blocking the screen', async () => {
  const source = fakeSource(() => new Promise(() => undefined));
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App containers={source} />);
  });
  expect(source.acquire).toHaveBeenCalledTimes(1);
  expect(renderer.root.findAllByType(Text).length).toBeGreaterThan(0);
});

test('logs the schema version once the database is ready', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App containers={fakeSource()} />);
  });
  expect(logSpy).toHaveBeenCalledWith('db ready (schema v2)');
});

test('releases the container on unmount', async () => {
  const source = fakeSource();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App containers={source} />);
  });
  expect(source.release).not.toHaveBeenCalled();
  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
  expect(source.release).toHaveBeenCalledTimes(1);
});

test('pairs every acquire with a release under StrictMode double effects', async () => {
  const source = fakeSource();
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(
      <React.StrictMode>
        <App containers={source} />
      </React.StrictMode>,
    );
  });
  expect(source.acquire.mock.calls.length).toBe(
    source.release.mock.calls.length + 1,
  );
});

test('reports a failed open instead of crashing', async () => {
  const errorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  const source = fakeSource(() => Promise.reject(new Error('disk full')));
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App containers={source} />);
  });
  expect(errorSpy).toHaveBeenCalledWith('db init failed', expect.any(Error));
});
