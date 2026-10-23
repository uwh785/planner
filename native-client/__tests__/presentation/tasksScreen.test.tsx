import { StyleSheet } from 'react-native';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { flushAsync } from '../helpers/plannerWorld';
import { renderSignedIn, type Rendered } from '../helpers/renderApp';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const settle = () => act(async () => flushAsync());

async function openList(name: string) {
  fireEvent.press(
    await screen.findByRole('button', { name: new RegExp(`^${name}`) }),
  );
  await screen.findByRole('header', { name });
}
async function openAll() {
  fireEvent.press(await screen.findByRole('button', { name: /^All tasks/ }));
  await screen.findByRole('header', { name: 'All tasks' });
}
const add = async (text: string) => {
  const field = screen.getByLabelText('Add a task');
  fireEvent.changeText(field, text);
  fireEvent(field, 'submitEditing');
  await settle();
};
const advance = async (env: Rendered, ms: number) => {
  act(() => env.timer.advance(ms));
  await settle();
};

describe('tasks screen', () => {
  it('starts empty with a plain prompt and a quick add field', async () => {
    const env = await renderSignedIn();
    await env.world.taskLists.create({ name: 'Home' });
    await openList('Home');
    expect(await screen.findByText('No tasks yet')).toBeTruthy();
    expect(screen.getByText('Add your first task above.')).toBeTruthy();
    const field = screen.getByLabelText('Add a task');
    expect(field.props.returnKeyType).toBe('done');
    expect(field.props.blurOnSubmit).toBe(false);
  });

  it('quick adds into the list on the keyboard action and clears the field', async () => {
    const env = await renderSignedIn();
    const list = await env.world.taskLists.create({ name: 'Home' });
    await openList('Home');
    await add('Buy milk');
    expect(
      await screen.findByRole('button', { name: /^Buy milk/ }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Add a task').props.value).toBe('');
    expect((await env.world.tasks.list())[0]).toMatchObject({
      title: 'Buy milk',
      listId: list.id,
    });
    expect(
      screen.getByText('Added Buy milk').props.accessibilityLiveRegion ??
        'polite',
    ).toBe('polite');
    expect(screen.queryByText('No tasks yet')).toBeNull();
  });

  it('adds to no list from "All tasks"', async () => {
    const env = await renderSignedIn();
    await openAll();
    await add('Loose task');
    await screen.findByRole('button', { name: /^Loose task/ });
    expect((await env.world.tasks.list())[0]!.listId).toBeNull();
  });

  it('shows open tasks in plan order with due text and a priority icon with its word', async () => {
    const env = await renderSignedIn();
    const at = (d: number) => new Date(2026, 11, d).getTime(); // Dec, after NOW
    await env.world.tasks.create({
      title: 'later',
      dueDate: at(20),
      dueAllDay: true,
      priority: 1,
    });
    await env.world.tasks.create({
      title: 'sooner',
      dueDate: at(2),
      dueAllDay: true,
      priority: 3,
    });
    await env.world.tasks.create({ title: 'nodate' });
    await openAll();
    const rows = await screen.findAllByRole('checkbox');
    expect(rows.map(r => r.props.accessibilityLabel)).toEqual([
      'Mark sooner as done',
      'Mark later as done',
      'Mark nodate as done',
    ]);
    const sooner = screen.getByRole('button', { name: /^sooner/ });
    expect(within(sooner).getByText('Dec 2')).toBeTruthy();
    expect(within(sooner).getByText('High')).toBeTruthy();
    expect(
      within(sooner).getByTestId('priority-flag', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(sooner.props.accessibilityLabel).toBe(
      'sooner, Dec 2, High priority',
    );
    const none = screen.getByRole('button', { name: /^nodate/ });
    expect(
      within(none).queryByTestId('priority-flag', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
  });

  it('words an overdue task, not just a color', async () => {
    const env = await renderSignedIn();
    await env.world.tasks.create({
      title: 'old',
      dueDate: new Date(2020, 0, 5).getTime(),
      dueAllDay: true,
    });
    await openAll();
    expect(await screen.findByText('Overdue, Jan 5, 2020')).toBeTruthy();
  });

  describe('completing', () => {
    async function withTask() {
      const env = await renderSignedIn();
      await env.world.tasks.create({ title: 'Call Ann' });
      await env.world.outbox.markSent(
        (await env.world.outbox.peekPending(9)).map(e => e.id),
      );
      await openAll();
      await screen.findByRole('button', { name: /^Call Ann/ });
      return env;
    }

    it('has a real checkbox with a 48dp target', async () => {
      await withTask();
      const box = screen.getByRole('checkbox', {
        name: 'Mark Call Ann as done',
      });
      expect(box.props.accessibilityState).toMatchObject({ checked: false });
      expect(StyleSheet.flatten(box.props.style)).toEqual(
        expect.objectContaining({ minWidth: 48, minHeight: 48 }),
      );
    });

    it('shows the row as completing with Undo, and writes nothing yet', async () => {
      const env = await withTask();
      fireEvent.press(
        screen.getByRole('checkbox', { name: 'Mark Call Ann as done' }),
      );
      await settle();
      expect(
        screen.getByRole('checkbox', { name: 'Mark Call Ann as done' }).props
          .accessibilityState,
      ).toMatchObject({ checked: true });
      expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
      expect(
        screen.getByText('Completed Call Ann. Undo is available.'),
      ).toBeTruthy();
      expect((await env.world.tasks.list())[0]!.status).toBe('pending');
      expect(await env.world.outbox.pendingCount()).toBe(0);
    });

    it('Undo cancels the completion for good', async () => {
      const env = await withTask();
      fireEvent.press(
        screen.getByRole('checkbox', { name: 'Mark Call Ann as done' }),
      );
      await settle();
      fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
      await settle();
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
      await advance(env, 10_000);
      expect((await env.world.tasks.list())[0]!.status).toBe('pending');
      expect(await env.world.outbox.pendingCount()).toBe(0);
      expect(
        screen.getByRole('checkbox', { name: 'Mark Call Ann as done' }).props
          .accessibilityState,
      ).toMatchObject({ checked: false });
    });

    it('when the window elapses the task is completed, queued, and moves to Completed', async () => {
      const env = await withTask();
      fireEvent.press(
        screen.getByRole('checkbox', { name: 'Mark Call Ann as done' }),
      );
      await settle();
      await advance(env, 5_000);
      expect((await env.world.tasks.list())[0]!.status).toBe('completed');
      expect((await env.world.outbox.peekPending(9))[0]).toMatchObject({
        op: 'complete',
      });
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull(),
      );
      expect(
        screen.queryByRole('checkbox', { name: 'Mark Call Ann as done' }),
      ).toBeNull();
      const header = screen.getByRole('button', { name: /^Completed, 1 task/ });
      expect(within(header).getByText('Completed (1)')).toBeTruthy();
      expect(within(header).getByText('Show')).toBeTruthy();
    });

    it('keeps completed tasks collapsed until asked, struck through with the word and date', async () => {
      const env = await renderSignedIn();
      const t = await env.world.tasks.create({ title: 'Done thing' });
      await env.world.tasks.complete(t.id, new Date(2026, 9, 21, 8).getTime());
      await openAll();
      expect(screen.queryByText('Done thing')).toBeNull();
      fireEvent.press(
        await screen.findByRole('button', { name: /^Completed, 1 task/ }),
      );
      const row = await screen.findByRole('button', { name: /^Done thing/ });
      expect(
        StyleSheet.flatten(within(row).getByText('Done thing').props.style),
      ).toMatchObject({ textDecorationLine: 'line-through' });
      expect(within(row).getByText('Completed Oct 21')).toBeTruthy();
      const box = screen.getByRole('checkbox', {
        name: 'Done thing, completed',
      });
      expect(box.props.accessibilityState).toMatchObject({
        checked: true,
        disabled: true,
      });
      expect(screen.getByText('Hide')).toBeTruthy();
    });

    it('flushes a pending completion when the screen goes away', async () => {
      const env = await withTask();
      fireEvent.press(
        screen.getByRole('checkbox', { name: 'Mark Call Ann as done' }),
      );
      await settle();
      fireEvent.press(screen.getByRole('button', { name: 'Back' }));
      await settle();
      expect((await env.world.tasks.list())[0]!.status).toBe('completed');
    });

    it('flushes when the app goes to the background', async () => {
      const env = await withTask();
      fireEvent.press(
        screen.getByRole('checkbox', { name: 'Mark Call Ann as done' }),
      );
      await settle();
      act(() => env.lifecycle.set(false));
      await settle();
      expect((await env.world.tasks.list())[0]!.status).toBe('completed');
    });
  });

  it('opens the edit screen from a row', async () => {
    const env = await renderSignedIn();
    await env.world.tasks.create({ title: 'Edit me' });
    await openAll();
    fireEvent.press(await screen.findByRole('button', { name: /^Edit me/ }));
    expect(
      await screen.findByRole('header', { name: 'Edit task' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Title').props.value).toBe('Edit me');
  });

  it('follows tasks that arrive from a pull while it is open', async () => {
    const env = await renderSignedIn();
    await openAll();
    await act(async () => {
      await env.world.remoteChanges.applyRemoteChanges({
        cursor: 1,
        tasks: [
          {
            task_id: 'tsk_remote',
            list_id: null,
            title: 'From the server',
            description: '',
            priority: 0,
            status: 'pending',
            due_date: null,
            due_all_day: false,
            duration_ms: null,
            started_at: null,
            elapsed_ms: 0,
            completed_at: null,
            sort_order: 0,
            updated_at: 3,
            deleted: false,
          },
        ],
      });
    });
    expect(
      await screen.findByRole('button', { name: /^From the server/ }),
    ).toBeTruthy();
  });

  it('wraps long titles instead of clipping them', async () => {
    const env = await renderSignedIn();
    await env.world.tasks.create({
      title:
        'A really long task title that needs several lines on a small screen with large text',
    });
    await openAll();
    const title = await screen.findByText(/A really long task title/);
    expect(title.props.numberOfLines).toBeUndefined();
  });
});

describe('list header actions', () => {
  it('renames, recolors and deletes the list from the edit list screen', async () => {
    const env = await renderSignedIn();
    const list = await env.world.taskLists.create({ name: 'Old' });
    const task = await env.world.tasks.create({
      title: 'inside',
      listId: list.id,
    });
    await openList('Old');
    fireEvent.press(screen.getByRole('button', { name: 'Edit list' }));
    expect(
      await screen.findByRole('header', { name: 'Edit list' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Name').props.value).toBe('Old');
    fireEvent.changeText(screen.getByLabelText('Name'), 'New name');
    fireEvent.press(screen.getByRole('radio', { name: 'Green' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'New name' });
    expect(await env.world.taskLists.get(list.id)).toMatchObject({
      name: 'New name',
      color: '#30D158',
    });

    fireEvent.press(screen.getByRole('button', { name: 'Edit list' }));
    await screen.findByRole('header', { name: 'Edit list' });
    const alert = jest.spyOn(require('react-native').Alert, 'alert');
    fireEvent.press(screen.getByRole('button', { name: 'Delete list' }));
    expect(alert).toHaveBeenCalledWith(
      'Delete this list?',
      'Its tasks stay and move out of any list.',
      expect.any(Array),
    );
    const buttons = alert.mock.calls[0]![2] as {
      text: string;
      onPress?: () => void;
    }[];
    expect(buttons.map(b => b.text)).toEqual(['Cancel', 'Delete']);
    expect(await env.world.taskLists.get(list.id)).not.toBeNull();
    await act(async () => buttons[1]!.onPress!());
    await screen.findByRole('header', { name: 'Lists' });
    expect(await env.world.taskLists.get(list.id)).toBeNull();
    expect((await env.world.tasks.get(task.id))?.listId).toBeNull();
    expect(screen.getByText('Deleted list New name')).toBeTruthy();
  });
});
