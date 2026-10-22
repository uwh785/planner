import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '@/presentation/App';
import { initDatabase } from '@/infrastructure/db/initDatabase';

jest.mock('@/infrastructure/db/initDatabase', () => ({
  initDatabase: jest.fn(() => Promise.resolve({ db: {}, schemaVersion: 1 })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders the Planner title', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const titles = renderer.root
    .findAllByType(Text)
    .filter(node => node.props.children === 'Planner');
  expect(titles).toHaveLength(1);
});

test('opens the local database once on mount without blocking the screen', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
  expect(initDatabase).toHaveBeenCalledTimes(1);
  expect(initDatabase).toHaveBeenCalledWith('planner_local.db');
});
