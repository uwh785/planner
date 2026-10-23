import { Alert, AccessibilityInfo } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { flushAsync } from '../helpers/plannerWorld';
import { NOW, renderSignedIn, type Rendered } from '../helpers/renderApp';

const HOUR = 3_600_000;
const MIN = 60_000;
const settle = () => act(async () => flushAsync());
const advance = async (env: Rendered, ms: number) => {
  act(() => env.timer.advance(ms));
  await settle();
};

let alert: jest.SpyInstance;
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
});
afterEach(() => jest.restoreAllMocks());

/** A task the server knows, so only the timer entries show in the outbox. */
async function seed(
  env: Rendered,
  patch: Record<string, unknown> = {},
  title = 'Prepare slides',
) {
  const task = await env.world.tasks.create({
    title,
    description: 'Slides for the Friday meeting',
    priority: 3,
    durationMs: 2 * HOUR,
    ...patch,
  });
  await env.world.outbox.markSent(
    (await env.world.outbox.peekPending(99)).map(e => e.id),
  );
  return task;
}

async function openDetail(env: Rendered, title = 'Prepare slides') {
  fireEvent.press(await screen.findByRole('tab', { name: 'Tasks' }));
  await screen.findByRole('header', { name: 'Tasks' });
  await settle();
  fireEvent.press(
    await screen.findByRole('button', { name: new RegExp(`^${title}`) }),
  );
  await screen.findByRole('header', { name: title });
  await settle();
  return env;
}

const outbox = (env: Rendered) => env.world.outbox.peekPending(99);
const press = (name: string | RegExp) =>
  fireEvent.press(screen.getByRole('button', { name }));

describe('opening the detail', () => {
  it('opens from a Tasks card with the web layout: header, description, priority, status, ring card, actions', async () => {
    const env = await renderSignedIn();
    await seed(env);
    await openDetail(env);
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit task' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete task' })).toBeTruthy();
    expect(screen.getByText('Slides for the Friday meeting')).toBeTruthy();
    expect(screen.getByLabelText('Priority: High')).toBeTruthy();
    expect(screen.getByLabelText('Status: Pending')).toBeTruthy();
    expect(screen.getByText('Time left')).toBeTruthy();
    expect(screen.getByText('2 h')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Start Prepare slides' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Complete Prepare slides' }),
    ).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Subtasks' })).toBeTruthy();
  });

  it('opens from a Panel card too', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await env.world.tasks.start(task.id, NOW - 10 * MIN);
    await settle();
    fireEvent.press(
      await screen.findByRole('button', { name: /^Prepare slides/ }),
    );
    expect(
      await screen.findByRole('header', { name: 'Prepare slides' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Status: In progress')).toBeTruthy();
  });

  it('never shows a raw status value', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await env.world.tasks.start(task.id, NOW);
    await openDetail(env);
    expect(screen.queryByText(/in_progress/)).toBeNull();
    expect(screen.queryByText(/pending/)).toBeNull();
  });

  it('hides the priority when there is none, and the ring card when there is no duration', async () => {
    const env = await renderSignedIn();
    await seed(env, { priority: 0, durationMs: null, description: '' });
    await openDetail(env);
    expect(screen.queryByText('Priority')).toBeNull();
    expect(screen.queryByText('Time left')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Start Prepare slides' }),
    ).toBeTruthy();
  });

  it('shows the due date when there is one', async () => {
    const env = await renderSignedIn();
    await seed(env, {
      dueDate: new Date(2026, 9, 24).getTime(),
      dueAllDay: true,
    });
    await openDetail(env);
    expect(screen.getByText('Due date')).toBeTruthy();
    expect(screen.getByText('Oct 24')).toBeTruthy();
  });

  it('is worded in Spanish like the web', async () => {
    const env = await renderSignedIn({ locale: 'es' });
    const task = await seed(env);
    await env.world.tasks.start(task.id, NOW);
    fireEvent.press(await screen.findByRole('tab', { name: 'Tareas' }));
    await settle();
    fireEvent.press(
      await screen.findByRole('button', { name: /^Prepare slides/ }),
    );
    await screen.findByRole('header', { name: 'Prepare slides' });
    await settle();
    expect(screen.getByText('Prioridad')).toBeTruthy();
    expect(screen.getByLabelText('Estado: En progreso')).toBeTruthy();
    expect(screen.getByText('Tiempo restante')).toBeTruthy();
    expect(screen.getByText('Pausar')).toBeTruthy();
    expect(screen.getByText('Completar')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Subtareas' })).toBeTruthy();
    expect(screen.getByLabelText('Nueva subtarea')).toBeTruthy();
  });

  it('Back, and the Android back button, return to the list', async () => {
    const env = await renderSignedIn();
    await seed(env);
    await openDetail(env);
    press('Back');
    expect(await screen.findByRole('header', { name: 'Tasks' })).toBeTruthy();
    fireEvent.press(
      await screen.findByRole('button', { name: /^Prepare slides/ }),
    );
    await screen.findByRole('header', { name: 'Prepare slides' });
    act(() => {
      (
        require('react-native').BackHandler as { mockPressBack(): void }
      ).mockPressBack();
    });
    expect(await screen.findByRole('header', { name: 'Tasks' })).toBeTruthy();
  });
});

describe('edit and delete', () => {
  it('the pencil opens the edit screen and saving returns to the detail with the new title', async () => {
    const env = await renderSignedIn();
    await seed(env);
    await openDetail(env);
    press('Edit task');
    await screen.findByRole('header', { name: 'Edit task' });
    fireEvent.changeText(screen.getByLabelText('Title'), 'Prepare the slides');
    press('Save');
    expect(
      await screen.findByRole('header', { name: 'Prepare the slides' }),
    ).toBeTruthy();
  });

  it('delete asks first; Cancel keeps the task', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await openDetail(env);
    press('Delete task');
    expect(alert).toHaveBeenCalledWith(
      'Delete this task?',
      'This action cannot be undone.',
      expect.any(Array),
    );
    expect(await env.world.tasks.get(task.id)).not.toBeNull();
    expect(screen.getByRole('header', { name: 'Prepare slides' })).toBeTruthy();
  });

  it('confirming deletes the task and goes back to the list with a message', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await openDetail(env);
    press('Delete task');
    const buttons = alert.mock.calls[0]![2] as {
      text: string;
      onPress?: () => void;
    }[];
    await act(async () => buttons[1]!.onPress!());
    expect(await screen.findByRole('header', { name: 'Tasks' })).toBeTruthy();
    expect(await env.world.tasks.get(task.id)).toBeNull();
    expect(screen.getByText('Deleted Prepare slides')).toBeTruthy();
    expect(screen.queryByText('This task no longer exists')).toBeNull();
  });

  it('says the task is gone when it is deleted elsewhere (a pull), and Back leaves', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await openDetail(env);
    await act(async () => {
      await env.world.tasks.delete(task.id);
    });
    await waitFor(() =>
      expect(screen.getByText('This task no longer exists')).toBeTruthy(),
    );
    press('Back');
    expect(await screen.findByRole('header', { name: 'Tasks' })).toBeTruthy();
  });
});

describe('start and pause', () => {
  it('Start puts the task in progress at the moment of the tap and queues a start op', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await openDetail(env);
    const tapped = env.world.clock.now();
    press('Start Prepare slides');
    await settle();
    expect(await env.world.tasks.get(task.id)).toMatchObject({
      status: 'in_progress',
      startedAt: tapped,
    });
    const [entry] = await outbox(env);
    expect(entry).toMatchObject({ op: 'start', payload: { at: tapped } });
    expect(screen.getByLabelText('Status: In progress')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Pause Prepare slides' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Start/ })).toBeNull();
    expect(screen.getByText('Started Prepare slides')).toBeTruthy();
  });

  it('Pause freezes the countdown with the time really run, and Start resumes it', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await openDetail(env);
    press('Start Prepare slides');
    await settle();
    await advance(env, 30 * MIN);
    press('Pause Prepare slides');
    await settle();
    expect(await env.world.tasks.get(task.id)).toMatchObject({
      status: 'pending',
      elapsedMs: 30 * MIN,
      startedAt: null,
    });
    expect(screen.getByText('1 h 30 min')).toBeTruthy();
    await advance(env, 3 * HOUR);
    expect(screen.getByText('1 h 30 min')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Start Prepare slides' }),
    ).toBeTruthy();
    await advance(env, 1_000);
    press('Start Prepare slides');
    await settle();
    expect((await outbox(env)).map(e => e.op)).toEqual([
      'start',
      'pause',
      'start',
    ]);
  });

  it('a double tap on Start writes one entry', async () => {
    const env = await renderSignedIn();
    await seed(env);
    await openDetail(env);
    const start = screen.getByRole('button', { name: 'Start Prepare slides' });
    fireEvent.press(start);
    fireEvent.press(start);
    await settle();
    expect(await outbox(env)).toHaveLength(1);
  });

  it('a quick Pause right after Start (a stray second tap) is ignored', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await openDetail(env);
    press('Start Prepare slides');
    await settle();
    fireEvent.press(
      screen.getByRole('button', { name: 'Pause Prepare slides' }),
    );
    await settle();
    expect((await env.world.tasks.get(task.id))?.status).toBe('in_progress');
    expect(await outbox(env)).toHaveLength(1);
  });
});

describe('the ticking ring card', () => {
  it('ticks every second while the task runs, counting the last minute in seconds', async () => {
    const env = await renderSignedIn();
    await seed(env, { durationMs: 90_000 });
    await openDetail(env);
    expect(screen.getByText('1 min')).toBeTruthy();
    press('Start Prepare slides');
    await settle();
    await advance(env, 50_000);
    expect(screen.getByText('40 s')).toBeTruthy();
    await advance(env, 1_000);
    expect(screen.getByText('39 s')).toBeTruthy();
    expect(screen.getByTestId('timer-box').props.accessibilityLabel).toMatch(
      /^Time left: 39 s\. 57% of the time used$/,
    );
  });

  it('does not tick while the task is not running', async () => {
    const env = await renderSignedIn();
    await seed(env, { durationMs: 90_000 });
    await openDetail(env);
    await advance(env, 50_000);
    expect(screen.getByText('1 min')).toBeTruthy();
  });

  it('shows Time over once the duration is used up', async () => {
    const env = await renderSignedIn();
    await seed(env, { durationMs: 2 * MIN });
    await openDetail(env);
    press('Start Prepare slides');
    await settle();
    await advance(env, 3 * MIN);
    expect(screen.getByText('Time over')).toBeTruthy();
  });

  it('honors reduced motion: it refreshes every 30 seconds instead of every second', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(
      true,
    );
    const env = await renderSignedIn();
    await seed(env, { durationMs: 90_000 });
    await openDetail(env);
    press('Start Prepare slides');
    await settle();
    await advance(env, 10_000);
    expect(screen.getByText('1 min')).toBeTruthy();
    await advance(env, 25_000);
    // 35 s in: a per-second tick would read 55 s; the 30 s tick still reads 1 min.
    expect(screen.queryByText('55 s')).toBeNull();
    expect(screen.getByText('1 min')).toBeTruthy();
    await advance(env, 25_000);
    expect(screen.getByText('30 s')).toBeTruthy();
  });
});

describe('completing from the detail', () => {
  it('uses the same undo window as the list: nothing is written until it elapses', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await openDetail(env);
    const tapped = env.world.clock.now();
    press('Complete Prepare slides');
    await settle();
    expect(screen.getByText('Completed', { exact: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Start/ })).toBeNull();
    expect((await env.world.tasks.get(task.id))?.status).toBe('pending');
    await advance(env, 4_000);
    expect((await env.world.tasks.get(task.id))?.status).toBe('pending');
    await advance(env, 1_000);
    expect(await env.world.tasks.get(task.id)).toMatchObject({
      status: 'completed',
      completedAt: tapped,
    });
    expect((await outbox(env)).map(e => [e.op, e.payload])).toEqual([
      ['complete', { at: tapped }],
    ]);
    expect(screen.getByLabelText('Status: Completed')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Undo|Complete Prepare/ }),
    ).toBeNull();
  });

  it('Undo cancels it and brings the actions back', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await openDetail(env);
    press('Complete Prepare slides');
    await settle();
    press('Undo');
    await settle();
    await advance(env, 10_000);
    expect((await env.world.tasks.get(task.id))?.status).toBe('pending');
    expect(await outbox(env)).toEqual([]);
    expect(
      screen.getByRole('button', { name: 'Start Prepare slides' }),
    ).toBeTruthy();
  });

  it('going back inside the window keeps it open, and the list shows the task as completing', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await openDetail(env);
    press('Complete Prepare slides');
    await settle();
    press('Back');
    await screen.findByRole('header', { name: 'Tasks' });
    await settle();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect((await env.world.tasks.get(task.id))?.status).toBe('pending');
    await advance(env, 5_000);
    expect((await env.world.tasks.get(task.id))?.status).toBe('completed');
  });

  it('a completed task shows its ring full, no actions, and subtasks stay editable', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await env.world.tasks.complete(task.id, NOW - 1_000);
    fireEvent.press(await screen.findByRole('tab', { name: 'Tasks' }));
    await screen.findByRole('header', { name: 'Tasks' });
    fireEvent.press(await screen.findByRole('radio', { name: 'Completed' }));
    await settle();
    fireEvent.press(
      await screen.findByRole('button', { name: /^Prepare slides/ }),
    );
    await screen.findByRole('header', { name: 'Prepare slides' });
    await settle();
    expect(
      screen.queryByRole('button', { name: /^(Start|Pause|Complete)/ }),
    ).toBeNull();
    expect(screen.getByLabelText('Status: Completed')).toBeTruthy();
    expect(screen.getByLabelText('New subtask')).toBeTruthy();
  });
});

describe('subtasks', () => {
  const addSubtask = async (text: string) => {
    const field = screen.getByLabelText('New subtask');
    fireEvent.changeText(field, text);
    fireEvent(field, 'submitEditing');
    await settle();
  };

  it('adds subtasks in order, clears the field and says so', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await openDetail(env);
    await addSubtask('Outline');
    await addSubtask('Draft');
    const titles = (await env.world.subtasks.listByTask(task.id)).map(
      s => s.title,
    );
    expect(titles).toEqual(['Outline', 'Draft']);
    expect(screen.getByRole('checkbox', { name: 'Outline' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Draft' })).toBeTruthy();
    expect(screen.getByLabelText('New subtask').props.value).toBe('');
    expect(screen.getByText('Added subtask Draft')).toBeTruthy();
  });

  it('refuses a blank title with the field error', async () => {
    const env = await renderSignedIn();
    await seed(env);
    await openDetail(env);
    await addSubtask('   ');
    expect(screen.getByText('Title is required')).toBeTruthy();
    expect(
      await env.world.subtasks.listByTask(
        (
          await env.world.tasks.list()
        )[0]!.id,
      ),
    ).toEqual([]);
  });

  it('toggles a subtask and queues the full body again', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await openDetail(env);
    await addSubtask('Outline');
    fireEvent.press(screen.getByRole('checkbox', { name: 'Outline' }));
    await settle();
    expect((await env.world.subtasks.listByTask(task.id))[0]).toMatchObject({
      completed: true,
    });
    expect(
      screen.getByRole('checkbox', { name: 'Outline' }).props
        .accessibilityState,
    ).toMatchObject({ checked: true });
    const subtaskOps = (await outbox(env)).filter(e => e.entity === 'subtask');
    expect(subtaskOps).toHaveLength(1);
    expect(subtaskOps[0]!.payload).toMatchObject({
      task_id: task.id,
      title: 'Outline',
      completed: true,
    });
  });

  it('deletes a subtask from its own button', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await openDetail(env);
    await addSubtask('Outline');
    press('Delete subtask Outline');
    await settle();
    expect(await env.world.subtasks.listByTask(task.id)).toEqual([]);
    expect(screen.queryByRole('checkbox', { name: 'Outline' })).toBeNull();
    expect(screen.getByText('Deleted subtask Outline')).toBeTruthy();
  });

  it('shows the subtasks that arrive from a pull', async () => {
    const env = await renderSignedIn();
    const task = await seed(env);
    await openDetail(env);
    await act(async () => {
      await env.world.remoteChanges.applyRemoteChanges({
        cursor: 5,
        subtasks: [
          {
            task_id: task.id,
            subtask_id: 'sub_remote',
            title: 'From the server',
            completed: false,
            sort_order: 0,
            updated_at: 10,
            deleted: false,
          },
        ],
      });
    });
    expect(
      await screen.findByRole('checkbox', { name: 'From the server' }),
    ).toBeTruthy();
  });
});
