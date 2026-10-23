import { StyleSheet } from 'react-native';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { CompletionWindow } from '@/application/planner/CompletionWindow';
import { flushAsync } from '../helpers/plannerWorld';
import { renderSignedIn, type Rendered } from '../helpers/renderApp';
import { openTestWorld } from '../helpers/testRepositories';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const settle = () => act(async () => flushAsync());

async function openTasks() {
  fireEvent.press(await screen.findByRole('tab', { name: 'Tasks' }));
  await screen.findByRole('header', { name: 'Tasks' });
  await settle();
}
const chip = (name: string, group: string) =>
  within(screen.getByLabelText(group)).getByRole('radio', { name });
const status = (name: string) => chip(name, 'Filter by status');
const list = (name: string) => chip(name, 'Filter by list');
const card = (title: string | RegExp) =>
  screen.findByRole('button', {
    name: typeof title === 'string' ? new RegExp(`^${title}`) : title,
  });
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

describe('leaving the tasks screen with a task in its undo window', () => {
  const tapComplete = async (title: string) => {
    fireEvent.press(
      await screen.findByRole('button', { name: `Complete ${title}` }),
    );
    await settle();
  };

  it('completes it when the user switches to another tab (tabs stay mounted)', async () => {
    const env = await renderSignedIn();
    const task = await env.world.tasks.create({ title: 'Buy milk' });
    await openTasks();
    await tapComplete('Buy milk');
    expect((await env.world.tasks.get(task.id))?.status).toBe('pending');
    fireEvent.press(screen.getByRole('tab', { name: 'Dashboard' }));
    await screen.findByRole('header', { name: 'Dashboard' });
    await settle();
    expect(await env.world.tasks.get(task.id)).toMatchObject({
      status: 'completed',
      completedAt: env.world.clock.now(),
    });
    expect(await env.world.outbox.peekPending(9)).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'complete' })]),
    );
  });

  it('keeps the window open while the user stays on the screen', async () => {
    const env = await renderSignedIn();
    const task = await env.world.tasks.create({ title: 'Buy milk' });
    await openTasks();
    await tapComplete('Buy milk');
    await advance(env, 2_000);
    expect((await env.world.tasks.get(task.id))?.status).toBe('pending');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('says so on the screen it lands on when the write on leaving fails', async () => {
    const env = await renderSignedIn();
    await env.world.tasks.create({ title: 'Buy milk' });
    await openTasks();
    await tapComplete('Buy milk');
    jest
      .spyOn(CompletionWindow.prototype, 'flush')
      .mockRejectedValue(new Error('disk'));
    fireEvent.press(screen.getByRole('tab', { name: 'Dashboard' }));
    await screen.findByRole('header', { name: 'Dashboard' });
    await settle();
    expect(screen.getByText('Some changes could not be saved.')).toBeTruthy();
  });

  it('names the task when its own write fails', async () => {
    const world = await openTestWorld();
    const env = await renderSignedIn({ world });
    await env.world.tasks.create({ title: 'Buy milk' });
    await openTasks();
    await tapComplete('Buy milk');
    jest.spyOn(world.tasks, 'complete').mockRejectedValue(new Error('disk'));
    fireEvent.press(screen.getByRole('tab', { name: 'Dashboard' }));
    await screen.findByRole('header', { name: 'Dashboard' });
    await settle();
    expect(
      screen.getByText("Couldn't complete Buy milk. Try again."),
    ).toBeTruthy();
  });
});

describe('tasks tab', () => {
  it('starts empty with a plain prompt and a quick add field', async () => {
    await renderSignedIn();
    await openTasks();
    expect(await screen.findByText('No tasks')).toBeTruthy();
    expect(screen.getByText('Type above to add your first task.')).toBeTruthy();
    const field = screen.getByLabelText('Add a task');
    expect(field.props.returnKeyType).toBe('done');
    expect(field.props.blurOnSubmit).toBe(false);
  });

  it('quick adds on the keyboard action, clears the field and says so', async () => {
    const env = await renderSignedIn();
    await openTasks();
    await add('Buy milk');
    expect(await card('Buy milk')).toBeTruthy();
    expect(screen.getByLabelText('Add a task').props.value).toBe('');
    expect((await env.world.tasks.list())[0]).toMatchObject({
      title: 'Buy milk',
      listId: null,
    });
    expect(screen.getByText('Added Buy milk')).toBeTruthy();
    expect(screen.queryByText('No tasks')).toBeNull();
  });

  it('explains a refused add in the user language', async () => {
    await renderSignedIn({ locale: 'es' });
    fireEvent.press(await screen.findByRole('tab', { name: 'Tareas' }));
    await screen.findByRole('header', { name: 'Tareas' });
    const field = screen.getByLabelText('Agregar una tarea');
    fireEvent.changeText(field, '   ');
    fireEvent(field, 'submitEditing');
    await settle();
    expect(screen.getByText('El título es obligatorio')).toBeTruthy();
  });

  it('shows the web card: status dot, title, priority badge, due text and description', async () => {
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
      description: 'Slides for Friday',
      dueDate: at(2),
      dueAllDay: true,
      priority: 3,
    });
    await env.world.tasks.create({ title: 'nodate' });
    await openTasks();
    const cards = await screen.findAllByTestId(/^task-card-/);
    expect(cards).toHaveLength(3);
    const soon = screen.getByRole('button', { name: /^sooner/ });
    expect(within(soon).getByText('Dec 2')).toBeTruthy();
    expect(within(soon).getByText('High')).toBeTruthy();
    expect(within(soon).getByText('Slides for Friday')).toBeTruthy();
    expect(
      within(soon).getByTestId('status-dot-pending', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(soon.props.accessibilityLabel).toBe(
      'sooner, Pending, Dec 2, high priority',
    );
    // Plan order: sooner, later, no date.
    expect(
      screen
        .getAllByRole('button', { name: /^(sooner|later|nodate)/ })
        .map(b => b.props.accessibilityLabel.split(',')[0]),
    ).toEqual(['sooner', 'later', 'nodate']);
    expect(
      within(screen.getByRole('button', { name: /^nodate/ })).queryByText(
        'High',
      ),
    ).toBeNull();
  });

  it('words an overdue task, not just a color', async () => {
    const env = await renderSignedIn();
    await env.world.tasks.create({
      title: 'old',
      dueDate: new Date(2020, 0, 5).getTime(),
      dueAllDay: true,
    });
    await openTasks();
    const text = await screen.findByText('Overdue, Jan 5, 2020');
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({
      fontWeight: '600',
    });
  });

  it('shows the remaining-time box with its spoken equivalent', async () => {
    const env = await renderSignedIn();
    await env.world.tasks.create({
      title: 'Timed',
      status: 'in_progress',
      durationMs: 2 * 3_600_000,
    });
    await openTasks();
    await card('Timed');
    expect(screen.getByLabelText('2 h left')).toBeTruthy();
    expect(screen.getByText('Time left')).toBeTruthy();
  });

  it('wraps long titles instead of clipping them', async () => {
    const env = await renderSignedIn();
    await env.world.tasks.create({
      title:
        'A really long task title that needs several lines on a small screen with large text',
    });
    await openTasks();
    const title = await screen.findByText(/A really long task title/);
    expect(title.props.numberOfLines).toBeUndefined();
  });

  it('opens the task detail from a card, and the pencil there opens the edit screen', async () => {
    const env = await renderSignedIn();
    await env.world.tasks.create({ title: 'Edit me' });
    await openTasks();
    fireEvent.press(await card('Edit me'));
    expect(await screen.findByRole('header', { name: 'Edit me' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Edit task' }));
    expect(
      await screen.findByRole('header', { name: 'Edit task' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Title').props.value).toBe('Edit me');
  });

  it('Start and Pause on the cards write the timer transitions', async () => {
    const env = await renderSignedIn();
    const task = await env.world.tasks.create({ title: 'Timed' });
    await env.world.outbox.markSent(
      (await env.world.outbox.peekPending(9)).map(e => e.id),
    );
    await openTasks();
    const tapped = env.world.clock.now();
    fireEvent.press(await screen.findByRole('button', { name: 'Start Timed' }));
    await settle();
    expect(await env.world.tasks.get(task.id)).toMatchObject({
      status: 'in_progress',
      startedAt: tapped,
    });
    expect(
      await screen.findByRole('button', { name: 'Pause Timed' }),
    ).toBeTruthy();
    await advance(env, 61_000);
    fireEvent.press(screen.getByRole('button', { name: 'Pause Timed' }));
    await settle();
    expect(await env.world.tasks.get(task.id)).toMatchObject({
      status: 'pending',
      elapsedMs: 61_000,
    });
    expect((await env.world.outbox.peekPending(9)).map(e => e.op)).toEqual([
      'start',
      'pause',
    ]);
  });

  it('follows tasks that arrive from a pull while it is open', async () => {
    const env = await renderSignedIn();
    await openTasks();
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
    expect(await card('From the server')).toBeTruthy();
  });
});

describe('filters', () => {
  async function seed(env: Rendered) {
    const home = await env.world.taskLists.create({ name: 'Home' });
    await env.world.taskLists.create({ name: 'Work' });
    await env.world.tasks.create({ title: 'pending home', listId: home.id });
    await env.world.tasks.create({ title: 'pending loose' });
    await env.world.tasks.create({
      title: 'running',
      status: 'in_progress',
    });
    await env.world.tasks.create({
      title: 'late one',
      dueDate: new Date(2020, 0, 5).getTime(),
      dueAllDay: true,
    });
    const done = await env.world.tasks.create({ title: 'done one' });
    await env.world.tasks.complete(done.id, 5);
    return home;
  }
  const titles = () =>
    screen
      .queryAllByRole('button', {
        name: /^(pending home|pending loose|running|late one|done one)/,
      })
      .map(b => b.props.accessibilityLabel.split(',')[0])
      .sort();

  it('offers the web filters, All selected first, announced as radios', async () => {
    const env = await renderSignedIn();
    await seed(env);
    await openTasks();
    const group = screen.getByLabelText('Filter by status');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(
      within(group)
        .getAllByRole('radio')
        .map(r => r.props.accessibilityLabel),
    ).toEqual(['All', 'Pending', 'In Progress', 'Completed', 'Overdue']);
    expect(status('All').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('filters by status like the web', async () => {
    const env = await renderSignedIn();
    await seed(env);
    await openTasks();
    await card('pending home');
    expect(titles()).toEqual([
      'late one',
      'pending home',
      'pending loose',
      'running',
    ]);

    fireEvent.press(status('Pending'));
    await settle();
    expect(titles()).toEqual(['late one', 'pending home', 'pending loose']);

    fireEvent.press(status('In Progress'));
    await settle();
    expect(titles()).toEqual(['running']);

    fireEvent.press(status('Overdue'));
    await settle();
    expect(titles()).toEqual(['late one']);

    fireEvent.press(status('Completed'));
    await settle();
    expect(titles()).toEqual(['done one']);
    expect(status('Completed').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('says so when a filter matches nothing', async () => {
    const env = await renderSignedIn();
    await env.world.tasks.create({ title: 'only pending' });
    await openTasks();
    fireEvent.press(status('In Progress'));
    await settle();
    expect(await screen.findByText('No tasks')).toBeTruthy();
    expect(screen.getByText('No task matches this filter.')).toBeTruthy();
  });

  it('filters by list with one chip per list and All first', async () => {
    const env = await renderSignedIn();
    await seed(env);
    await openTasks();
    const group = screen.getByLabelText('Filter by list');
    expect(
      within(group)
        .getAllByRole('radio')
        .map(r => r.props.accessibilityLabel),
    ).toEqual(['All', 'Home', 'Work']);
    fireEvent.press(list('Home'));
    await settle();
    expect(titles()).toEqual(['pending home']);
    expect(list('Home').props.accessibilityState).toMatchObject({
      selected: true,
    });
    fireEvent.press(list('Work'));
    await settle();
    expect(titles()).toEqual([]);
    fireEvent.press(list('All'));
    await settle();
    expect(titles()).toContain('pending loose');
  });

  it('combines the list filter with a status filter', async () => {
    const env = await renderSignedIn();
    const home = await seed(env);
    await env.world.tasks.create({
      title: 'running home',
      status: 'in_progress',
      listId: home.id,
    });
    await openTasks();
    fireEvent.press(list('Home'));
    fireEvent.press(status('In Progress'));
    await settle();
    expect(
      screen
        .getAllByRole('button', { name: /^running/ })
        .map(b => b.props.accessibilityLabel.split(',')[0]),
    ).toEqual(['running home']);
  });

  it('has no list chips until there is a list', async () => {
    await renderSignedIn();
    await openTasks();
    expect(screen.queryByLabelText('Filter by list')).toBeNull();
  });

  it('quick add creates in the selected list', async () => {
    const env = await renderSignedIn();
    const home = await seed(env);
    await openTasks();
    fireEvent.press(list('Home'));
    await settle();
    await add('Water plants');
    await card('Water plants');
    expect(
      (await env.world.tasks.list()).find(t => t.title === 'Water plants'),
    ).toMatchObject({ listId: home.id });
    fireEvent.press(list('All'));
    await settle();
    await add('Loose again');
    await card('Loose again');
    expect(
      (await env.world.tasks.list()).find(t => t.title === 'Loose again'),
    ).toMatchObject({ listId: null });
  });

  it('falls back to every list when the selected list is deleted', async () => {
    const env = await renderSignedIn();
    const home = await seed(env);
    await openTasks();
    fireEvent.press(list('Home'));
    await settle();
    await act(async () => {
      await env.world.taskLists.delete(home.id);
    });
    await settle();
    expect(screen.queryByRole('radio', { name: 'Home' })).toBeNull();
    expect(titles()).toContain('pending home');
    expect(titles()).toContain('pending loose');
  });
});

describe('completing', () => {
  async function withTask() {
    const env = await renderSignedIn();
    await env.world.tasks.create({ title: 'Call Ann' });
    await env.world.outbox.markSent(
      (await env.world.outbox.peekPending(9)).map(e => e.id),
    );
    await openTasks();
    await card('Call Ann');
    return env;
  }
  const completeButton = () =>
    screen.getByRole('button', { name: 'Complete Call Ann' });

  it('has a Complete action with a 48dp target, labelled with the task', async () => {
    await withTask();
    expect(within(completeButton()).getByText('Complete')).toBeTruthy();
    expect(StyleSheet.flatten(completeButton().props.style)).toEqual(
      expect.objectContaining({ minHeight: 48 }),
    );
  });

  it('shows the card as completing with Undo, and writes nothing yet', async () => {
    const env = await withTask();
    fireEvent.press(completeButton());
    await settle();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(
      within(screen.getByTestId(/^task-card-/)).getByText('Completed'),
    ).toBeTruthy();
    expect(
      screen.getByText('Completed Call Ann. Undo is available.'),
    ).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByText('Call Ann').props.style),
    ).toMatchObject({ textDecorationLine: 'line-through' });
    expect((await env.world.tasks.list())[0]!.status).toBe('pending');
    expect(await env.world.outbox.pendingCount()).toBe(0);
  });

  it('Undo cancels the completion for good', async () => {
    const env = await withTask();
    fireEvent.press(completeButton());
    await settle();
    fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    await settle();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    await advance(env, 10_000);
    expect((await env.world.tasks.list())[0]!.status).toBe('pending');
    expect(await env.world.outbox.pendingCount()).toBe(0);
    expect(completeButton()).toBeTruthy();
  });

  it('when the window elapses the task is completed, queued, and moves to Completed', async () => {
    const env = await withTask();
    fireEvent.press(completeButton());
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
      screen.queryByRole('button', { name: 'Complete Call Ann' }),
    ).toBeNull();
    const header = screen.getByRole('button', { name: /^Completed, 1 task/ });
    expect(within(header).getByText('Completed (1)')).toBeTruthy();
    expect(within(header).getByText('Show')).toBeTruthy();
  });

  it('keeps completed tasks collapsed until asked, struck through with the word and date', async () => {
    const env = await renderSignedIn();
    const t = await env.world.tasks.create({ title: 'Done thing' });
    await env.world.tasks.complete(t.id, new Date(2026, 9, 21, 8).getTime());
    await openTasks();
    expect(screen.queryByText('Done thing')).toBeNull();
    fireEvent.press(
      await screen.findByRole('button', { name: /^Completed, 1 task/ }),
    );
    const done = await card('Done thing');
    expect(
      StyleSheet.flatten(within(done).getByText('Done thing').props.style),
    ).toMatchObject({ textDecorationLine: 'line-through' });
    expect(within(done).getByText('Completed Oct 21')).toBeTruthy();
    expect(done.props.accessibilityLabel).toBe(
      'Done thing, Completed, Completed Oct 21',
    );
    // A finished task has no Complete action.
    expect(screen.queryByRole('button', { name: /^Complete Done/ })).toBeNull();
    expect(screen.getByText('Hide')).toBeTruthy();
  });

  it('flushes a pending completion when the app goes to the background', async () => {
    const env = await withTask();
    fireEvent.press(completeButton());
    await settle();
    act(() => env.lifecycle.set(false));
    await settle();
    expect((await env.world.tasks.list())[0]!.status).toBe('completed');
  });

  it('flushes when the Tasks tab goes away (sign out unmounts it)', async () => {
    const env = await withTask();
    fireEvent.press(completeButton());
    await settle();
    fireEvent.press(screen.getByRole('tab', { name: 'Settings' }));
    await settle();
    // The tab stays mounted and the window keeps running; sign-out flushes.
    fireEvent.press(await screen.findByRole('button', { name: 'Sign Out' }));
    await settle();
    expect((await env.world.tasks.list())[0]!.status).toBe('completed');
  });
});
