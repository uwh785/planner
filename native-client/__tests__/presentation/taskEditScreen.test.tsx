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

async function openEdit(
  patch: Record<string, unknown> = {},
  title = 'Write report',
) {
  env = await renderSignedIn();
  const task = await env.world.tasks.create({ title, ...patch });
  await env.world.outbox.markSent(
    (await env.world.outbox.peekPending(9)).map(e => e.id),
  );
  fireEvent.press(await screen.findByRole('tab', { name: 'Tasks' }));
  fireEvent.press(
    await screen.findByRole('button', { name: new RegExp(`^${title}`) }),
  );
  await screen.findByRole('header', { name: 'Edit task' });
  return task;
}

describe('edit task', () => {
  it('shows the task in labeled fields, in reading order', async () => {
    await openEdit({ description: 'Quarterly', priority: 2 });
    expect(screen.getByLabelText('Title').props.value).toBe('Write report');
    expect(screen.getByLabelText('Description').props.value).toBe('Quarterly');
    expect(
      screen.getByRole('radio', { name: 'Medium' }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.getByText('No due date')).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'No list' }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    const order = screen
      .getAllByRole('header')
      .map(h => h.props.children as string);
    expect(order).toEqual(['Edit task', 'Priority', 'Due date', 'List']);
  });

  it('saves only when asked, then goes back to the list with a message', async () => {
    const task = await openEdit();
    fireEvent.changeText(screen.getByLabelText('Title'), ' Write the report ');
    fireEvent.changeText(screen.getByLabelText('Description'), 'Draft first');
    fireEvent.press(screen.getByRole('radio', { name: 'High' }));
    expect((await env.world.tasks.get(task.id))?.title).toBe('Write report');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Tasks' });
    expect(await env.world.tasks.get(task.id)).toMatchObject({
      title: 'Write the report',
      description: 'Draft first',
      priority: 3,
    });
    expect(
      await screen.findByRole('button', { name: /^Write the report/ }),
    ).toBeTruthy();
    expect(screen.getByText('Saved Write the report')).toBeTruthy();
    expect((await env.world.outbox.peekPending(9)).map(e => e.op)).toEqual([
      'upsert',
    ]);
  });

  it('refuses a blank title and stays on the form with an announced error', async () => {
    const task = await openEdit();
    fireEvent.changeText(screen.getByLabelText('Title'), '   ');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Error: Title is required')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Edit task' })).toBeTruthy();
    expect((await env.world.tasks.get(task.id))?.title).toBe('Write report');
  });

  it('sets a date and an optional time with the native pickers', async () => {
    const task = await openEdit();
    pickNext(new Date(2026, 11, 25));
    fireEvent.press(screen.getByRole('button', { name: 'Pick date' }));
    expect(openPicker).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'date' }),
    );
    expect(await screen.findByText('Dec 25')).toBeTruthy();
    const allDay = screen.getByRole('switch', { name: 'All day' });
    expect(allDay.props.value).toBe(true);
    fireEvent(allDay, 'valueChange', false);
    pickNext(new Date(2026, 11, 25, 14, 30));
    fireEvent.press(await screen.findByRole('button', { name: 'Set time' }));
    expect(openPicker).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'time', is24Hour: true }),
    );
    expect(await screen.findByText('Dec 25, 14:30')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Tasks' });
    expect(await env.world.tasks.get(task.id)).toMatchObject({
      dueDate: new Date(2026, 11, 25, 14, 30).getTime(),
      dueAllDay: false,
    });
  });

  it('stores an all-day date at local midnight and can clear it', async () => {
    const task = await openEdit({
      dueDate: new Date(2026, 10, 1).getTime(),
      dueAllDay: true,
    });
    expect(screen.getByText('Nov 1')).toBeTruthy();
    pickNext(new Date(2026, 11, 3, 17, 45));
    fireEvent.press(screen.getByRole('button', { name: 'Change date' }));
    await screen.findByText('Dec 3');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Tasks' });
    expect((await env.world.tasks.get(task.id))?.dueDate).toBe(
      new Date(2026, 11, 3).getTime(),
    );
    fireEvent.press(
      await screen.findByRole('button', { name: /^Write report/ }),
    );
    await screen.findByRole('header', { name: 'Edit task' });
    fireEvent.press(screen.getByRole('button', { name: 'Clear date' }));
    expect(screen.getByText('No due date')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'All day' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Tasks' });
    expect((await env.world.tasks.get(task.id))?.dueDate).toBeNull();
  });

  it('leaves the date alone when the picker is dismissed', async () => {
    await openEdit();
    pickNext(null);
    fireEvent.press(screen.getByRole('button', { name: 'Pick date' }));
    await settle();
    expect(screen.getByText('No due date')).toBeTruthy();
  });

  it('moves the task to another list with the list picker', async () => {
    const task = await openEdit();
    const home = await env.world.taskLists.create({ name: 'Home' });
    fireEvent.press(await screen.findByRole('radio', { name: 'Home' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Tasks' });
    expect((await env.world.tasks.get(task.id))?.listId).toBe(home.id);
  });

  describe('unsaved changes', () => {
    it('going back with nothing changed just goes back', async () => {
      await openEdit();
      fireEvent.press(screen.getByRole('button', { name: 'Back' }));
      await screen.findByRole('header', { name: 'Tasks' });
      expect(alert).not.toHaveBeenCalled();
    });

    it('asks before discarding edits; Keep editing stays, Discard leaves', async () => {
      const task = await openEdit();
      fireEvent.changeText(screen.getByLabelText('Title'), 'Changed');
      fireEvent.press(screen.getByRole('button', { name: 'Back' }));
      expect(alert).toHaveBeenCalledWith(
        'Discard changes?',
        'Your edits to this task are not saved.',
        expect.any(Array),
      );
      const buttons = alert.mock.calls[0]![2] as {
        text: string;
        onPress?: () => void;
      }[];
      expect(buttons.map(b => b.text)).toEqual(['Keep editing', 'Discard']);
      expect(screen.getByRole('header', { name: 'Edit task' })).toBeTruthy();
      await act(async () => buttons[1]!.onPress!());
      await screen.findByRole('header', { name: 'Tasks' });
      expect((await env.world.tasks.get(task.id))?.title).toBe('Write report');
    });

    it('the system back button is guarded the same way', async () => {
      await openEdit();
      fireEvent.changeText(screen.getByLabelText('Title'), 'Changed');
      const { BackHandler } = require('react-native');
      act(() => {
        BackHandler.mockPressBack();
      });
      expect(alert).toHaveBeenCalledWith(
        'Discard changes?',
        expect.any(String),
        expect.any(Array),
      );
    });
  });

  describe('delete', () => {
    it('asks first, then deletes and goes back with a message', async () => {
      const task = await openEdit();
      fireEvent.press(screen.getByRole('button', { name: 'Delete task' }));
      expect(alert).toHaveBeenCalledWith(
        'Delete this task?',
        'This action cannot be undone.',
        expect.any(Array),
      );
      const buttons = alert.mock.calls[0]![2] as {
        text: string;
        style?: string;
        onPress?: () => void;
      }[];
      expect(buttons.map(b => b.text)).toEqual(['Cancel', 'Delete']);
      expect(buttons[1]!.style).toBe('destructive');
      expect(await env.world.tasks.get(task.id)).not.toBeNull();
      await act(async () => buttons[1]!.onPress!());
      await screen.findByRole('header', { name: 'Tasks' });
      expect(await env.world.tasks.get(task.id)).toBeNull();
      expect(
        screen.queryByRole('button', { name: /^Write report/ }),
      ).toBeNull();
      expect(screen.getByText('Deleted Write report')).toBeTruthy();
    });

    it('deleting does not trigger the discard question even with edits', async () => {
      await openEdit();
      fireEvent.changeText(screen.getByLabelText('Title'), 'Changed');
      fireEvent.press(screen.getByRole('button', { name: 'Delete task' }));
      const buttons = alert.mock.calls[0]![2] as {
        text: string;
        onPress?: () => void;
      }[];
      alert.mockClear();
      await act(async () => buttons[1]!.onPress!());
      await screen.findByRole('header', { name: 'Tasks' });
      expect(alert).not.toHaveBeenCalled();
    });
  });

  it('tells the user when the task is gone (deleted on another device)', async () => {
    const task = await openEdit();
    await act(async () => {
      await env.world.tasks.delete(task.id);
    });
    await waitFor(() =>
      expect(screen.getByText('This task no longer exists')).toBeTruthy(),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('header', { name: 'Tasks' });
  });
});
