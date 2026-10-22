import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '@/presentation/App';

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
