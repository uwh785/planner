import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { flushAsync } from '../helpers/plannerWorld';
import { renderSignedIn, type Rendered } from '../helpers/renderApp';

jest.mock('@react-native-community/datetimepicker', () => ({
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));

const openPicker = DateTimePickerAndroid.open as jest.Mock;
const settle = () => act(async () => flushAsync());

/** Answers the next native picker as the user would. */
const pickNext = (date: Date | null) =>
  openPicker.mockImplementationOnce(
    (params: { onChange: (e: { type: string }, d?: Date) => void }) =>
      params.onChange({ type: date ? 'set' : 'dismissed' }, date ?? undefined),
  );

let env: Rendered;
let alert: jest.SpyInstance;
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  openPicker.mockReset();
});
afterEach(() => jest.restoreAllMocks());

// The test clock reads Thursday 22 Oct 2026, 10:00.
const THURSDAY = 4;

async function openSchedule() {
  env = await renderSignedIn();
  return env;
}
async function goToSchedule() {
  fireEvent.press(await screen.findByRole('tab', { name: 'Schedule' }));
  await screen.findByRole('header', { name: 'Schedule' });
}
const seed = (patch: Record<string, unknown> = {}) =>
  env.world.classSessions.create({
    subject: 'Física',
    dayOfWeek: THURSDAY,
    startMinute: 540,
    endMinute: 630,
    ...patch,
  });
const day = (name: string) => screen.getByRole('radio', { name });
const selected = (name: string) =>
  day(name).props.accessibilityState.selected as boolean;

describe('Schedule tab', () => {
  it('opens on today with Monday-first day tabs and an empty-day line', async () => {
    await openSchedule();
    await goToSchedule();
    expect(
      screen
        .getAllByRole('radio')
        .map(tab => tab.props.accessibilityLabel as string),
    ).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(selected('Thursday')).toBe(true);
    expect(selected('Monday')).toBe(false);
    expect(screen.getByText('No classes this day')).toBeTruthy();
  });

  it('lists the selected day by start time, with room and teacher', async () => {
    await openSchedule();
    await seed({ subject: 'Química', startMinute: 660, endMinute: 720 });
    await seed({ room: 'A1', teacher: 'Ruiz' });
    await seed({ subject: 'Lunes', dayOfWeek: 1 });
    await goToSchedule();
    const cards = screen
      .getAllByRole('button')
      .map(b => b.props.accessibilityLabel as string)
      .filter(label => /–/.test(label));
    expect(cards).toEqual([
      'FÍSICA, 09:00 – 10:30, A1, Ruiz',
      'QUÍMICA, 11:00 – 12:00',
    ]);
    fireEvent.press(day('Monday'));
    expect(selected('Monday')).toBe(true);
    expect(screen.getByRole('button', { name: /^LUNES/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^FÍSICA/ })).toBeNull();
  });

  it('follows changes to the classes', async () => {
    await openSchedule();
    await goToSchedule();
    await seed();
    expect(await screen.findByRole('button', { name: /^FÍSICA/ })).toBeTruthy();
    expect(screen.queryByText('No classes this day')).toBeNull();
  });

  it('speaks Spanish with the web letters', async () => {
    env = await renderSignedIn({ locale: 'es' });
    fireEvent.press(await screen.findByRole('tab', { name: 'Horario' }));
    await screen.findByRole('header', { name: 'Horario' });
    expect(screen.getByRole('radio', { name: 'Jueves' })).toBeTruthy();
    expect(screen.getByText('No hay clases este día')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Agregar clase' })).toBeTruthy();
  });
});

describe('add a class', () => {
  async function openAdd() {
    await openSchedule();
    await goToSchedule();
    fireEvent.press(screen.getByRole('radio', { name: 'Friday' }));
    fireEvent.press(screen.getByRole('button', { name: 'Add class' }));
    await screen.findByRole('header', { name: 'New class' });
  }

  it('starts on the selected day with 08:00 to 09:00 and saves a trimmed subject', async () => {
    await openAdd();
    expect(
      screen.getByRole('radio', { name: 'Friday' }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.getByRole('button', { name: 'Start, 08:00' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'End, 09:00' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete class' })).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Subject'), '  Historia ');
    fireEvent.changeText(screen.getByLabelText('Room'), 'B2');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Schedule' });
    const [saved] = await env.world.classSessions.list();
    expect(saved).toMatchObject({
      subject: 'HISTORIA',
      dayOfWeek: 5,
      startMinute: 480,
      endMinute: 540,
      room: 'B2',
      color: '#0A84FF',
    });
    expect(await env.world.outbox.pendingCount()).toBe(1);
    expect(screen.getByText('Added class HISTORIA')).toBeTruthy();
    // The new class is on Friday, where the user was.
    expect(
      await screen.findByRole('button', { name: /^HISTORIA/ }),
    ).toBeTruthy();
  });

  it('blocks an empty subject and an end that is not after the start', async () => {
    await openAdd();
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Subject is required')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Subject'), 'Arte');
    pickNext(new Date(2026, 9, 22, 7, 30));
    fireEvent.press(screen.getByRole('button', { name: 'End, 09:00' }));
    expect(
      await screen.findByRole('button', { name: 'End, 07:30' }),
    ).toBeTruthy();
    expect(openPicker).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'time', is24Hour: true }),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('End time must be after start time'),
    ).toBeTruthy();
    expect(await env.world.classSessions.list()).toEqual([]);
    pickNext(new Date(2026, 9, 22, 10, 0));
    fireEvent.press(screen.getByRole('button', { name: 'End, 07:30' }));
    await screen.findByRole('button', { name: 'End, 10:00' });
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Schedule' });
    expect((await env.world.classSessions.list())[0]).toMatchObject({
      subject: 'ARTE',
      endMinute: 600,
    });
  });

  it('suggests used subjects (accents folded) and lends their teacher and color', async () => {
    env = await renderSignedIn();
    await seed({ teacher: 'Ruiz', color: '#FF453A' });
    await goToSchedule();
    fireEvent.press(screen.getByRole('button', { name: 'Add class' }));
    await screen.findByRole('header', { name: 'New class' });
    const subject = screen.getByLabelText('Subject');
    fireEvent(subject, 'focus');
    fireEvent.changeText(subject, 'fis');
    fireEvent.press(await screen.findByRole('button', { name: 'FÍSICA' }));
    expect(screen.getByLabelText('Subject').props.value).toBe('FÍSICA');
    expect(screen.getByLabelText('Teacher').props.value).toBe('Ruiz');
    expect(
      screen.getByText(
        'Teacher and color taken from another class with the same subject',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Red' }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    // Editing the teacher ends the inheritance and keeps the user's words.
    fireEvent.changeText(screen.getByLabelText('Teacher'), 'Paz');
    expect(
      screen.queryByText(
        'Teacher and color taken from another class with the same subject',
      ),
    ).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Subject'), 'física');
    expect(screen.getByLabelText('Teacher').props.value).toBe('Paz');
  });

  it('lists every used subject on "Show subjects"', async () => {
    env = await renderSignedIn();
    await seed();
    await seed({ subject: 'Arte', dayOfWeek: 2 });
    await goToSchedule();
    fireEvent.press(screen.getByRole('button', { name: 'Add class' }));
    await screen.findByRole('header', { name: 'New class' });
    expect(screen.queryByRole('button', { name: 'ARTE' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Show subjects' }));
    expect(screen.getByRole('button', { name: 'ARTE' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'FÍSICA' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Hide subjects' }));
    expect(screen.queryByRole('button', { name: 'ARTE' })).toBeNull();
  });

  it('asks before discarding an unsaved class', async () => {
    await openAdd();
    fireEvent.changeText(screen.getByLabelText('Subject'), 'Arte');
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(alert).toHaveBeenCalledWith(
      'Discard changes?',
      'Your edits to this class are not saved.',
      expect.any(Array),
    );
    expect(screen.getByRole('header', { name: 'New class' })).toBeTruthy();
  });
});

describe('edit and delete a class', () => {
  async function openEdit(patch: Record<string, unknown> = {}) {
    env = await renderSignedIn();
    const created = await seed({ teacher: 'Ruiz', color: '#FF453A', ...patch });
    await goToSchedule();
    fireEvent.press(await screen.findByRole('button', { name: /^FÍSICA/ }));
    await screen.findByRole('header', { name: 'Edit class' });
    return created;
  }

  it('fills the form from the class and saves changes', async () => {
    const created = await openEdit({ room: 'A1' });
    expect(screen.getByLabelText('Subject').props.value).toBe('FÍSICA');
    expect(screen.getByLabelText('Room').props.value).toBe('A1');
    expect(screen.getByLabelText('Teacher').props.value).toBe('Ruiz');
    expect(screen.getByRole('button', { name: 'Start, 09:00' })).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Thursday' }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    fireEvent.press(screen.getByRole('radio', { name: 'Tuesday' }));
    fireEvent.changeText(screen.getByLabelText('Room'), 'C3');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Schedule' });
    expect(await env.world.classSessions.get(created.id)).toMatchObject({
      dayOfWeek: 2,
      room: 'C3',
      teacher: 'Ruiz',
    });
    expect(screen.getByText('Saved class FÍSICA')).toBeTruthy();
  });

  it('keeps the class teacher and color when its subject is retyped', async () => {
    await openEdit();
    fireEvent.changeText(screen.getByLabelText('Subject'), 'Arte');
    fireEvent.changeText(screen.getByLabelText('Subject'), 'Física');
    expect(screen.getByLabelText('Teacher').props.value).toBe('Ruiz');
    expect(
      screen.queryByText(
        'Teacher and color taken from another class with the same subject',
      ),
    ).toBeNull();
  });

  it('deletes only after a confirmation', async () => {
    const created = await openEdit();
    fireEvent.press(screen.getByRole('button', { name: 'Delete class' }));
    expect(alert).toHaveBeenCalledWith(
      'Delete this class?',
      undefined,
      expect.any(Array),
    );
    expect(await env.world.classSessions.get(created.id)).not.toBeNull();
    const buttons = alert.mock.calls.at(-1)![2] as {
      text: string;
      onPress?: () => void;
    }[];
    await act(async () => {
      buttons.find(b => b.text === 'Delete')!.onPress!();
      await flushAsync();
    });
    await screen.findByRole('header', { name: 'Schedule' });
    expect(await env.world.classSessions.get(created.id)).toBeNull();
    expect(screen.getByText('Deleted class FÍSICA')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText('No classes this day')).toBeTruthy(),
    );
  });

  it('says so when the class was deleted elsewhere', async () => {
    const created = await openEdit();
    await act(async () => {
      await env.world.classSessions.delete(created.id);
      await flushAsync();
    });
    expect(await screen.findByText('This class no longer exists')).toBeTruthy();
    await settle();
  });
});
