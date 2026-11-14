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

// Every class row's spoken label, top to bottom.
const classLabels = () =>
  screen
    .getAllByLabelText(/\d\d:\d\d – \d\d:\d\d/)
    .map(node => node.props.accessibilityLabel as string);

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

  it('lists the whole day in order, with time, room and teacher', async () => {
    const env = await renderSignedIn();
    const make = (
      subject: string,
      startMinute: number,
      endMinute: number,
      extra: { room?: string; teacher?: string } = {},
    ) =>
      env.world.classSessions.create({
        subject,
        dayOfWeek: THURSDAY,
        startMinute,
        endMinute,
        ...extra,
      });
    await make('Música', 900, 960);
    await make('Física', 570, 630, { room: 'B204' });
    await make('Inglés', 480, 540, { room: 'A1', teacher: 'Ruiz' });
    await make('Química', 660, 720, { teacher: 'Díaz' });
    await make('Arte', 780, 840);
    await settle();
    expect(
      screen.getByRole('header', { name: "Today's classes" }),
    ).toBeTruthy();
    expect(classLabels()).toEqual([
      'INGLÉS, Finished, 08:00 – 09:00, A1, Ruiz',
      'FÍSICA, Ends in 30 min, 09:30 – 10:30, B204',
      'QUÍMICA, Starts in 1 h, 11:00 – 12:00, Díaz',
      'ARTE, 13:00 – 14:00',
      'MÚSICA, 15:00 – 16:00',
    ]);
    expect(screen.getByText('Ends in 30 min')).toBeTruthy();
    expect(screen.getByText('08:00 – 09:00 · A1, Ruiz')).toBeTruthy();
  });

  it("still lists the day's classes once they are over", async () => {
    const env = await renderSignedIn();
    await env.world.classSessions.create({
      subject: 'Física',
      dayOfWeek: THURSDAY,
      startMinute: 300,
      endMinute: 360,
    });
    await settle();
    expect(
      screen.getByRole('header', { name: "Today's classes" }),
    ).toBeTruthy();
    expect(classLabels()).toEqual(['FÍSICA, Finished, 05:00 – 06:00']);
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
    expect(screen.getByLabelText(/^FÍSICA, Termina en 30 min/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver horario' })).toBeTruthy();
  });
});
