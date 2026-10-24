import { act, fireEvent, screen } from '@testing-library/react-native';
import { flushAsync } from '../helpers/plannerWorld';
import { renderSignedIn } from '../helpers/renderApp';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const settle = () => act(async () => flushAsync());
// The test clock reads Thursday 22 Oct 2026, 10:00.
const THURSDAY = 4;

describe("Panel: today's classes", () => {
  it('shows no block when today has no class', async () => {
    const env = await renderSignedIn();
    await env.world.classSessions.create({
      subject: 'Lunes',
      dayOfWeek: 1,
      startMinute: 540,
      endMinute: 600,
    });
    await settle();
    expect(screen.queryByText("Today's classes")).toBeNull();
    expect(screen.queryByRole('button', { name: 'View schedule' })).toBeNull();
  });

  it('shows the class in progress, the next one and the rest', async () => {
    const env = await renderSignedIn();
    const make = (subject: string, startMinute: number, endMinute: number) =>
      env.world.classSessions.create({
        subject,
        dayOfWeek: THURSDAY,
        startMinute,
        endMinute,
      });
    await make('Física', 570, 630);
    await make('Química', 660, 720);
    await make('Arte', 780, 840);
    await make('Música', 900, 960);
    await settle();
    expect(
      screen.getByRole('header', { name: "Today's classes" }),
    ).toBeTruthy();
    expect(screen.getByLabelText('FÍSICA, Ends in 30 min')).toBeTruthy();
    expect(screen.getByLabelText('QUÍMICA, Starts in 1 h')).toBeTruthy();
    expect(screen.getByText('Ends in 30 min')).toBeTruthy();
    expect(screen.getByLabelText('ARTE, 13:00 – 14:00')).toBeTruthy();
    expect(screen.getByLabelText('MÚSICA, 15:00 – 16:00')).toBeTruthy();
  });

  it("keeps the heading but shows no card once the day's classes are over", async () => {
    const env = await renderSignedIn();
    await env.world.classSessions.create({
      subject: 'Física',
      dayOfWeek: THURSDAY,
      startMinute: 300,
      endMinute: 360,
    });
    await settle();
    // Over already: the block is there (today has a class) but has no cards.
    expect(
      screen.getByRole('header', { name: "Today's classes" }),
    ).toBeTruthy();
    expect(screen.queryByText(/Ends in|Starts in/)).toBeNull();
  });

  it('opens the Schedule tab from "View schedule"', async () => {
    const env = await renderSignedIn();
    await env.world.classSessions.create({
      subject: 'Física',
      dayOfWeek: THURSDAY,
      startMinute: 660,
      endMinute: 720,
    });
    await settle();
    fireEvent.press(screen.getByRole('button', { name: 'View schedule' }));
    expect(
      await screen.findByRole('header', { name: 'Schedule' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: 'Schedule' }).props.accessibilityState,
    ).toMatchObject({ selected: true });
  });

  it('words the block in Spanish', async () => {
    const env = await renderSignedIn({ locale: 'es' });
    await env.world.classSessions.create({
      subject: 'Física',
      dayOfWeek: THURSDAY,
      startMinute: 570,
      endMinute: 630,
    });
    await settle();
    expect(screen.getByRole('header', { name: 'Clases de hoy' })).toBeTruthy();
    expect(screen.getByText('Termina en 30 min')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver horario' })).toBeTruthy();
  });
});
