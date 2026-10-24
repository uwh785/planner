import { act, fireEvent, screen } from '@testing-library/react-native';
import { flushAsync } from '../helpers/plannerWorld';
import { renderSignedIn } from '../helpers/renderApp';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const settle = () => act(async () => flushAsync());
// The test clock reads Thursday 22 Oct 2026, 10:00.
const at = (d: number, h: number) => new Date(2026, 9, d, h).getTime();

describe("Panel: today's events", () => {
  it('shows no block when today has no event', async () => {
    const env = await renderSignedIn();
    await env.world.events.create({ title: 'Tomorrow', startAt: at(23, 9) });
    await settle();
    expect(screen.queryByText("Today's events")).toBeNull();
  });

  it("lists today's events, all-day first, and opens one for editing", async () => {
    const env = await renderSignedIn();
    await env.world.events.create({
      title: 'Dentist',
      startAt: at(22, 14),
      location: 'Clinic',
    });
    await env.world.events.create({
      title: 'Holiday',
      allDay: true,
      startAt: at(22, 0),
    });
    await env.world.events.create({
      title: 'Trip',
      startAt: at(21, 20),
      endAt: at(23, 8),
    });
    await env.world.events.create({ title: 'Later', startAt: at(24, 9) });
    await settle();
    expect(screen.getByRole('header', { name: "Today's events" })).toBeTruthy();
    const labels = screen
      .getAllByRole('button')
      .map(b => b.props.accessibilityLabel as string)
      .filter(label => /^(Holiday|Dentist|Trip)/.test(label));
    expect(labels).toEqual([
      'Trip, 20:00 – 23 oct 08:00',
      'Holiday, All day',
      'Dentist, 14:00, Clinic',
    ]);
    expect(screen.queryByRole('button', { name: /^Later/ })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: /^Dentist/ }));
    expect(
      await screen.findByRole('header', { name: 'Edit event' }),
    ).toBeTruthy();
  });
});
