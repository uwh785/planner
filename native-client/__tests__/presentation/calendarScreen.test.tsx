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
const at = (m: number, d: number, h = 0, min = 0) =>
  new Date(2026, m, d, h, min).getTime();

async function goToCalendar(options: { locale?: 'es' | 'en' } = {}) {
  env = env ?? (await renderSignedIn(options));
  fireEvent.press(
    await screen.findByRole('tab', {
      name: options.locale === 'es' ? 'Calendario' : 'Calendar',
    }),
  );
  await screen.findByRole('header', {
    name: options.locale === 'es' ? 'Calendario' : 'Calendar',
  });
}
async function open(options: { locale?: 'es' | 'en' } = {}) {
  env = await renderSignedIn(options);
  await goToCalendar(options);
}
const seed = (patch: Record<string, unknown> = {}) =>
  env.world.events.create({
    title: 'Dentist',
    startAt: at(9, 22, 14),
    ...patch,
  });
const cell = (label: string | RegExp) =>
  screen.getByRole('button', { name: label });

describe('Calendar tab', () => {
  it('opens on this month with Sunday-first weekdays and today selected', async () => {
    await open();
    expect(screen.getByRole('header', { name: 'Oct 2026' })).toBeTruthy();
    expect(
      screen
        .getAllByLabelText(/^(Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day$/)
        .map(h => h.props.accessibilityLabel),
    ).toEqual([
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]);
    expect(cell('Oct 22, 2026, today').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(cell('Oct 1, 2026').props.accessibilityState).toMatchObject({
      selected: false,
    });
    expect(screen.getByText('No events this day')).toBeTruthy();
  });

  it('marks each day with its events and tasks, capped at three', async () => {
    await open();
    await seed();
    await seed({ title: 'Lab', startAt: at(9, 22, 9) });
    await env.world.tasks.create({ title: 'Report', dueDate: at(9, 22, 18) });
    for (let i = 0; i < 4; i += 1) {
      await seed({ title: `E${i}`, startAt: at(9, 5, 8 + i) });
      await env.world.tasks.create({
        title: `T${i}`,
        dueDate: at(9, 5, 8 + i),
      });
    }
    await settle();
    expect(cell('Oct 22, 2026, today, 2 events, 1 task')).toBeTruthy();
    const busy = cell('Oct 5, 2026, 4 events, 4 tasks');
    expect(busy).toBeTruthy();
    // Four events and four tasks: three marks each, then "+1" twice.
    expect(screen.getAllByText('+1', { includeHiddenElements: true })).toHaveLength(2);
    expect(cell('Oct 6, 2026')).toBeTruthy();
  });

  it('shows the selected day as cards, all-day first, and follows changes', async () => {
    await open();
    await seed({ location: 'Clinic', endAt: at(9, 22, 15, 30) });
    await seed({ title: 'Holiday', allDay: true, startAt: at(9, 22) });
    await settle();
    const cards = screen
      .getAllByRole('button')
      .map(b => b.props.accessibilityLabel as string)
      .filter(label => /^(Holiday|Dentist)/.test(label));
    expect(cards).toEqual([
      'Holiday, All day',
      'Dentist, 14:00 – 15:30, Clinic',
    ]);
    fireEvent.press(cell('Oct 23, 2026'));
    expect(screen.getByText('No events this day')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Dentist/ })).toBeNull();
  });

  it('lists a multi-day event on every day it spans, the exclusive end aside', async () => {
    await open();
    await seed({
      title: 'Trip',
      startAt: at(9, 22, 20),
      endAt: at(9, 24),
    });
    await settle();
    fireEvent.press(cell(/^Oct 23, 2026/));
    expect(
      screen.getByRole('button', { name: /^Trip, 20:00 – 24 oct 00:00/ }),
    ).toBeTruthy();
    fireEvent.press(cell(/^Oct 24, 2026/));
    expect(screen.queryByRole('button', { name: /^Trip/ })).toBeNull();
  });

  it('moves between months and selects the 1st', async () => {
    await open();
    fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('header', { name: 'Nov 2026' })).toBeTruthy();
    expect(cell('Nov 1, 2026').props.accessibilityState).toMatchObject({
      selected: true,
    });
    fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('header', { name: 'Sep 2026' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    expect(cell('Oct 22, 2026, today').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('speaks Spanish', async () => {
    await open({ locale: 'es' });
    expect(screen.getByRole('header', { name: 'Oct 2026' })).toBeTruthy();
    expect(screen.getByLabelText('Domingo')).toBeTruthy();
    expect(screen.getByText('No hay eventos este día')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nuevo Evento' })).toBeTruthy();
  });
});

describe('add an event', () => {
  async function openAdd() {
    await open();
    fireEvent.press(cell(/^Oct 25, 2026/));
    fireEvent.press(screen.getByRole('button', { name: 'New Event' }));
    await screen.findByRole('header', { name: 'New Event' });
  }

  it('starts on the selected day at 09:00 and saves a trimmed title', async () => {
    await openAdd();
    expect(screen.getByRole('button', { name: 'Date, Oct 25' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start, 09:00' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'End (optional), --:--' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete event' })).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Title'), '  Concert ');
    fireEvent.changeText(screen.getByLabelText('Location (optional)'), ' Hall ');
    fireEvent.changeText(screen.getByLabelText('Notes (optional)'), 'Bring tickets');
    fireEvent.press(screen.getByRole('radio', { name: 'Red' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Calendar' });
    const [saved] = await env.world.events.list();
    expect(saved).toMatchObject({
      title: 'Concert',
      location: 'Hall',
      description: 'Bring tickets',
      startAt: at(9, 25, 9),
      endAt: null,
      allDay: false,
      color: '#FF453A',
    });
    expect(await env.world.outbox.pendingCount()).toBe(1);
    expect(screen.getByText('Added event Concert')).toBeTruthy();
    expect(
      await screen.findByRole('button', { name: /^Concert/ }),
    ).toBeTruthy();
  });

  it('blocks an empty title and an end before the start', async () => {
    await openAdd();
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Title is required')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Title'), 'Exam');
    pickNext(new Date(2026, 9, 25, 8, 30));
    fireEvent.press(
      screen.getByRole('button', { name: 'End (optional), --:--' }),
    );
    await screen.findByRole('button', { name: 'End (optional), 08:30' });
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('End time cannot be before start time'),
    ).toBeTruthy();
    expect(await env.world.events.list()).toEqual([]);
    fireEvent.press(screen.getByRole('button', { name: 'Clear end' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Calendar' });
    expect((await env.world.events.list())[0]).toMatchObject({ endAt: null });
  });

  it('picks another date and a time range with the system dialogs', async () => {
    await openAdd();
    fireEvent.changeText(screen.getByLabelText('Title'), 'Meeting');
    pickNext(new Date(2026, 9, 27));
    fireEvent.press(screen.getByRole('button', { name: 'Date, Oct 25' }));
    await screen.findByRole('button', { name: 'Date, Oct 27' });
    expect(openPicker).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'date' }),
    );
    pickNext(new Date(2026, 9, 27, 13, 15));
    fireEvent.press(screen.getByRole('button', { name: 'Start, 09:00' }));
    await screen.findByRole('button', { name: 'Start, 13:15' });
    pickNext(new Date(2026, 9, 27, 14, 0));
    fireEvent.press(
      screen.getByRole('button', { name: 'End (optional), --:--' }),
    );
    await screen.findByRole('button', { name: 'End (optional), 14:00' });
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Calendar' });
    expect((await env.world.events.list())[0]).toMatchObject({
      startAt: at(9, 27, 13, 15),
      endAt: at(9, 27, 14, 0),
    });
  });

  it('saves an all-day event at local midnight without an end', async () => {
    await openAdd();
    fireEvent.changeText(screen.getByLabelText('Title'), 'Holiday');
    fireEvent(
      screen.getByRole('switch', { name: 'All day' }),
      'valueChange',
      true,
    );
    expect(screen.queryByRole('button', { name: /^Start/ })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Calendar' });
    expect((await env.world.events.list())[0]).toMatchObject({
      allDay: true,
      startAt: at(9, 25),
      endAt: null,
    });
  });

  it('leaves the reminder off unless the user turns it on', async () => {
    await openAdd();
    const remind = screen.getByRole('switch', {
      name: 'Remind me on the home panel',
    });
    expect(remind.props.value).toBe(false);
    fireEvent.changeText(screen.getByLabelText('Title'), 'Exam');
    fireEvent(remind, 'valueChange', true);
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Calendar' });
    expect((await env.world.events.list())[0]).toMatchObject({
      remind: true,
      startAt: at(9, 25, 9),
    });
  });

  it('sets the date N days from today and turns the reminder on with a shortcut', async () => {
    await openAdd();
    fireEvent.changeText(screen.getByLabelText('Title'), 'Recharge');
    const shortcuts = ['In 30 days', 'In 60 days', 'In 90 days'].map(name =>
      screen.getByRole('radio', { name }),
    );
    expect(shortcuts.map(s => s.props.accessibilityState.selected)).toEqual([
      false,
      false,
      false,
    ]);
    fireEvent.press(shortcuts[1]!);
    // 60 days after Oct 22 (today), not after the day the form opened on.
    await screen.findByRole('button', { name: 'Date, Dec 21' });
    expect(
      screen.getByRole('switch', { name: 'Remind me on the home panel' }).props
        .value,
    ).toBe(true);
    expect(
      screen.getByRole('radio', { name: 'In 60 days' }).props
        .accessibilityState,
    ).toMatchObject({ selected: true });
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Calendar' });
    expect((await env.world.events.list())[0]).toMatchObject({
      remind: true,
      startAt: at(9, 22 + 60, 9),
      endAt: null,
    });
  });

  it('asks before discarding a date picked with a shortcut', async () => {
    await openAdd();
    fireEvent.press(screen.getByRole('radio', { name: 'In 90 days' }));
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(alert).toHaveBeenCalledWith(
      'Discard changes?',
      'Your edits to this event are not saved.',
      expect.any(Array),
    );
  });

  it('asks before discarding an unsaved event', async () => {
    await openAdd();
    fireEvent.changeText(screen.getByLabelText('Title'), 'Exam');
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(alert).toHaveBeenCalledWith(
      'Discard changes?',
      'Your edits to this event are not saved.',
      expect.any(Array),
    );
    expect(screen.getByRole('header', { name: 'New Event' })).toBeTruthy();
  });
});

describe('edit and delete an event', () => {
  async function openEdit(patch: Record<string, unknown> = {}) {
    await open();
    const created = await seed({
      location: 'Clinic',
      color: '#BF5AF2',
      ...patch,
    });
    await settle();
    fireEvent.press(await screen.findByRole('button', { name: /^Dentist/ }));
    await screen.findByRole('header', { name: 'Edit event' });
    return created;
  }

  it('fills the form from the event and saves changes', async () => {
    const created = await openEdit({ description: 'Notes' });
    expect(screen.getByLabelText('Title').props.value).toBe('Dentist');
    expect(screen.getByLabelText('Location (optional)').props.value).toBe('Clinic');
    expect(screen.getByLabelText('Notes (optional)').props.value).toBe('Notes');
    expect(screen.getByRole('button', { name: 'Start, 14:00' })).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Purple' }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    fireEvent.changeText(screen.getByLabelText('Location (optional)'), 'Office');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Calendar' });
    expect(await env.world.events.get(created.id)).toMatchObject({
      location: 'Office',
      startAt: at(9, 22, 14),
    });
    expect(screen.getByText('Saved event Dentist')).toBeTruthy();
  });

  it('keeps the dates of a multi-day event when only its notes change', async () => {
    const created = await openEdit({ endAt: at(9, 24, 11) });
    fireEvent.changeText(screen.getByLabelText('Notes (optional)'), 'Pack');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Calendar' });
    expect(await env.world.events.get(created.id)).toMatchObject({
      description: 'Pack',
      startAt: at(9, 22, 14),
      endAt: at(9, 24, 11),
    });
  });

  it('moves an existing event with a shortcut, keeping its time', async () => {
    const created = await openEdit();
    fireEvent.press(screen.getByRole('radio', { name: 'In 30 days' }));
    await screen.findByRole('button', { name: 'Date, Nov 21' });
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Calendar' });
    expect(await env.world.events.get(created.id)).toMatchObject({
      remind: true,
      startAt: at(10, 21, 14),
      endAt: null,
    });
  });

  it('saves only the reminder of a multi-day event, keeping its dates', async () => {
    const created = await openEdit({ endAt: at(9, 24, 11) });
    fireEvent(
      screen.getByRole('switch', { name: 'Remind me on the home panel' }),
      'valueChange',
      true,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Calendar' });
    expect(await env.world.events.get(created.id)).toMatchObject({
      remind: true,
      startAt: at(9, 22, 14),
      endAt: at(9, 24, 11),
    });
  });

  it('shows the stored reminder and can turn it off', async () => {
    const created = await openEdit({ remind: true });
    const remind = screen.getByRole('switch', {
      name: 'Remind me on the home panel',
    });
    expect(remind.props.value).toBe(true);
    fireEvent(remind, 'valueChange', false);
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Calendar' });
    expect((await env.world.events.get(created.id))!.remind).toBe(false);
  });

  it('shows a custom color as its own row', async () => {
    await openEdit({ color: '#123456' });
    expect(
      screen.getByRole('radio', { name: 'Custom' }).props.accessibilityState,
    ).toMatchObject({ selected: true });
  });

  it('deletes only after a confirmation', async () => {
    const created = await openEdit();
    fireEvent.press(screen.getByRole('button', { name: 'Delete event' }));
    expect(alert).toHaveBeenCalledWith(
      'Delete this event?',
      undefined,
      expect.any(Array),
    );
    expect(await env.world.events.get(created.id)).not.toBeNull();
    const buttons = alert.mock.calls.at(-1)![2] as {
      text: string;
      onPress?: () => void;
    }[];
    await act(async () => {
      buttons.find(b => b.text === 'Delete')!.onPress!();
      await flushAsync();
    });
    await screen.findByRole('header', { name: 'Calendar' });
    expect(await env.world.events.get(created.id)).toBeNull();
    expect(screen.getByText('Deleted event Dentist')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText('No events this day')).toBeTruthy(),
    );
  });

  it('says so when the event was deleted elsewhere', async () => {
    const created = await openEdit();
    await act(async () => {
      await env.world.events.delete(created.id);
      await flushAsync();
    });
    expect(
      await screen.findByText(
        'We could not find this event. It may have been deleted.',
      ),
    ).toBeTruthy();
    await settle();
  });
});
