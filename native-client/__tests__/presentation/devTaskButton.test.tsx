import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { AppContainer } from '@/application/container';
import { ContainerProvider } from '@/presentation/containerContext';
import { DevTaskButton } from '@/presentation/screens/DevTaskButton';

const withContainer = (create: jest.Mock | null) => {
  const container =
    create === null ? null : ({ tasks: { create } } as unknown as AppContainer);
  render(
    <ContainerProvider value={container}>
      <DevTaskButton />
    </ContainerProvider>,
  );
};

afterEach(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

it('queues a sample task in development builds', () => {
  const create = jest.fn(async () => ({}));
  withContainer(create);
  fireEvent.press(
    screen.getByRole('button', { name: 'Add sample task (dev)' }),
  );
  expect(create).toHaveBeenCalledWith({
    title: expect.stringMatching(/^Sample task /),
  });
});

it('renders nothing before the database is open', () => {
  withContainer(null);
  expect(screen.queryByRole('button')).toBeNull();
});

it('renders nothing in release builds', () => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  withContainer(jest.fn());
  expect(screen.queryByRole('button')).toBeNull();
});
