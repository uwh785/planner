import { BackHandler } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { flushAsync } from '../helpers/plannerWorld';
import { renderSignedIn } from '../helpers/renderApp';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const pressSystemBack = () => {
  let handled = true;
  act(() => {
    // The RN jest mock reports whether any handler took the press.
    handled =
      (
        BackHandler as unknown as { mockPressBack(): boolean | void }
      ).mockPressBack() !== false;
  });
  return handled;
};

it('the Android back button pops one screen at a time', async () => {
  await renderSignedIn();
  fireEvent.press(await screen.findByRole('button', { name: /^All tasks/ }));
  await screen.findByRole('header', { name: 'All tasks' });
  pressSystemBack();
  expect(await screen.findByRole('header', { name: 'Lists' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Account' }));
  await screen.findByRole('header', { name: 'Account' });
  pressSystemBack();
  expect(await screen.findByRole('header', { name: 'Lists' })).toBeTruthy();
});

it('shows exactly one screen at a time (no stacked duplicates in the reading order)', async () => {
  await renderSignedIn();
  fireEvent.press(await screen.findByRole('button', { name: /^All tasks/ }));
  await screen.findByRole('header', { name: 'All tasks' });
  await act(async () => flushAsync());
  expect(screen.getAllByRole('header', { name: 'All tasks' })).toHaveLength(1);
});

it('uses no transition animation (calm, and fine with reduced motion)', async () => {
  const {
    screenOptions,
  } = require('@/presentation/navigation/SignedInNavigator');
  expect(screenOptions).toMatchObject({
    headerShown: false,
    animation: 'none',
  });
});
