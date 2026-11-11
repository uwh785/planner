import { act, fireEvent, screen } from '@testing-library/react-native';
import { flushAsync } from '../helpers/plannerWorld';
import { renderSignedIn } from '../helpers/renderApp';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const settle = () => act(async () => flushAsync());
// The test clock reads Thursday 22 Oct 2026, 10:00.
const at = (m: number, d: number, h = 0) => new Date(2026, m, d, h).getTime();

const reminderLabels = () =>
  screen
    .getAllByRole('button')
    .map(b => b.props.accessibilityLabel as string)
    .filter(label => /(left|Today|Tomorrow)$/.test(label));

describe('Panel: reminders', () => {
  it('shows no block without an upcoming flagged event', async () => {
    const env = await renderSignedIn();
    await env.world.events.create({ title: 'Plain', startAt: at(10, 20, 9) });
    await env.world.events.create({
      title: 'Gone',
      startAt: at(9, 21, 9),
      remind: true,
    });
    await settle();
    expect(screen.queryByText('Reminders')).toBeNull();
  });

  it('lists flagged events soonest first with their countdown, above the events of today', async () => {
    const env = await renderSignedIn();
    await env.world.events.create({
      title: 'Recharge',
      startAt: at(10, 20, 9),
      remind: true,
    });
    await env.world.events.create({
      title: 'Renew',
      startAt: at(9, 23, 9),
      remind: true,
    });
    await env.world.events.create({
      title: 'Pay',
      startAt: at(9, 22, 18),
      remind: true,
    });
    await settle();
    expect(reminderLabels()).toEqual([
      'Pay, 22 oct, Today',
      'Renew, 23 oct, Tomorrow',
      'Recharge, 20 nov, 29 days left',
    ]);
    expect(screen.getByText('29 days left')).toBeTruthy();
    const headers = screen
      .getAllByRole('header')
      .map(h => h.props.children as string);
    expect(headers.indexOf('Reminders')).toBeGreaterThan(-1);
    expect(headers.indexOf('Reminders')).toBeLessThan(
      headers.indexOf("Today's events"),
    );
  });

  it('opens the event from its reminder', async () => {
    const env = await renderSignedIn();
    await env.world.events.create({
      title: 'Recharge',
      startAt: at(10, 20, 9),
      remind: true,
    });
    await settle();
    fireEvent.press(screen.getByRole('button', { name: /^Recharge/ }));
    expect(
      await screen.findByRole('header', { name: 'Edit event' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('switch', { name: 'Remind me on the home panel' }).props
        .value,
    ).toBe(true);
  });

  it('reads in Spanish', async () => {
    const env = await renderSignedIn({ locale: 'es' });
    await env.world.events.create({
      title: 'Recarga',
      startAt: at(10, 20, 9),
      remind: true,
    });
    await settle();
    expect(screen.getByRole('header', { name: 'Recordatorios' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Recarga, 20 nov, Faltan 29 días' }),
    ).toBeTruthy();
  });
});
