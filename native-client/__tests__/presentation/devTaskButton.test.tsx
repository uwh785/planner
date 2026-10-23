import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { AppContainer } from '@/application/container';
import { ContainerProvider } from '@/presentation/containerContext';
import { DevTaskButton } from '@/presentation/screens/DevTaskButton';
import { withLocale } from '../helpers/i18n';

const withContainer = async (create: jest.Mock | null) => {
  const container =
    create === null ? null : ({ tasks: { create } } as unknown as AppContainer);
  const { Wrapper, ready } = withLocale('en');
  await ready;
  render(
    <Wrapper>
      <ContainerProvider value={container}>
        <DevTaskButton />
      </ContainerProvider>
    </Wrapper>,
  );
};

afterEach(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

it('queues a sample task in development builds', async () => {
  const create = jest.fn(async () => ({}));
  await withContainer(create);
  fireEvent.press(
    screen.getByRole('button', { name: 'Add sample task (dev)' }),
  );
  expect(create).toHaveBeenCalledWith({
    title: expect.stringMatching(/^Sample task /),
  });
});

it('renders nothing before the database is open', async () => {
  await withContainer(null);
  expect(screen.queryByRole('button')).toBeNull();
});

it('renders nothing in release builds', async () => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  await withContainer(jest.fn());
  expect(screen.queryByRole('button')).toBeNull();
});
