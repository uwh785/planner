import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StartupErrorScreen } from '@/presentation/screens/StartupErrorScreen';

it('explains a startup failure in plain words', () => {
  render(<StartupErrorScreen message="Planner is not set up correctly." />);
  expect(screen.getByRole('header')).toHaveTextContent("Planner can't start");
  expect(screen.getByText('Planner is not set up correctly.')).toBeTruthy();
});
