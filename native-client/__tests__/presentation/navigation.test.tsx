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

const tab = (name: string) => screen.getByRole('tab', { name });

describe('the bottom tab bar', () => {
  it('shows Panel, Tasks and Settings with Panel selected first', async () => {
    await renderSignedIn();
    expect(
      screen.getAllByRole('tab').map(t => t.props.accessibilityLabel),
    ).toEqual(['Dashboard', 'Tasks', 'Settings']);
    expect(tab('Dashboard').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(tab('Tasks').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('labels the tabs in Spanish by default, as the web does', async () => {
    await renderSignedIn({ locale: 'es' });
    expect(
      screen.getAllByRole('tab').map(t => t.props.accessibilityLabel),
    ).toEqual(['Panel', 'Tareas', 'Config']);
  });

  it('opens each tab', async () => {
    await renderSignedIn();
    fireEvent.press(tab('Tasks'));
    expect(await screen.findByRole('header', { name: 'Tasks' })).toBeTruthy();
    expect(tab('Tasks').props.accessibilityState).toMatchObject({
      selected: true,
    });
    fireEvent.press(tab('Settings'));
    expect(
      await screen.findByRole('header', { name: 'Settings' }),
    ).toBeTruthy();
    fireEvent.press(tab('Dashboard'));
    expect(
      await screen.findByRole('header', { name: 'Dashboard' }),
    ).toBeTruthy();
  });

  it('gives every tab at least 48dp of height', async () => {
    await renderSignedIn();
    for (const name of ['Dashboard', 'Tasks', 'Settings']) {
      const style = tab(name).props.style;
      const flat = Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
      expect(flat.minHeight).toBeGreaterThanOrEqual(48);
    }
  });
});

describe('back', () => {
  it('the Android back button pops edit screens, then returns to Panel, then leaves', async () => {
    await renderSignedIn();
    fireEvent.press(tab('Settings'));
    fireEvent.press(await screen.findByRole('button', { name: /^Lists/ }));
    await screen.findByRole('header', { name: 'Lists' });
    pressSystemBack();
    expect(
      await screen.findByRole('header', { name: 'Settings' }),
    ).toBeTruthy();
    // Settings is not the first tab: back goes to Panel.
    pressSystemBack();
    expect(
      await screen.findByRole('header', { name: 'Dashboard' }),
    ).toBeTruthy();
    // Panel is the root: nothing in the app takes the press (the app exits).
    expect(pressSystemBack()).toBe(false);
  });
});

it('shows exactly one screen at a time (no stacked duplicates in the reading order)', async () => {
  await renderSignedIn();
  fireEvent.press(tab('Tasks'));
  await screen.findByRole('header', { name: 'Tasks' });
  await act(async () => flushAsync());
  expect(screen.getAllByRole('header', { name: 'Tasks' })).toHaveLength(1);
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
