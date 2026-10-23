import { StyleSheet } from 'react-native';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { SyncStatus } from '@/application/sync/SyncStatus';
import { flushAsync } from '../helpers/plannerWorld';
import { NOW, renderSignedIn, type Rendered } from '../helpers/renderApp';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const settle = () => act(async () => flushAsync());
const HOUR = 3_600_000;
const MIN = 60_000;

async function seed(env: Rendered) {
  await env.world.tasks.create({ title: 'waiting' });
  await env.world.tasks.create({
    title: 'Prepare slides',
    description: 'Slides for the Friday meeting',
    status: 'in_progress',
    priority: 3,
    durationMs: 2 * HOUR,
  });
  const done = await env.world.tasks.create({ title: 'done one' });
  await env.world.tasks.complete(done.id, 5);
  await env.world.tasks.create({
    title: 'late',
    dueDate: new Date(2020, 0, 5).getTime(),
    dueAllDay: true,
  });
}

describe('panel counters', () => {
  it('shows the four counters, each with its label and its number', async () => {
    const env = await renderSignedIn();
    await seed(env);
    await settle();
    // pending: waiting + late; in progress: 1; completed: 1; overdue: late.
    expect(screen.getByLabelText('Pending: 2')).toBeTruthy();
    expect(screen.getByLabelText('In Progress: 1')).toBeTruthy();
    expect(screen.getByLabelText('Completed: 1')).toBeTruthy();
    expect(screen.getByLabelText('Overdue: 1')).toBeTruthy();
    for (const label of ['Pending', 'In Progress', 'Completed', 'Overdue']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('is all zeros on a fresh account', async () => {
    await renderSignedIn();
    await settle();
    for (const label of ['Pending', 'In Progress', 'Completed', 'Overdue']) {
      expect(screen.getByLabelText(`${label}: 0`)).toBeTruthy();
    }
  });

  it('uses the web rules for overdue: all-day tasks only once their day has ended', async () => {
    const env = await renderSignedIn();
    const startOfToday = new Date(2026, 9, 22).getTime();
    await env.world.tasks.create({
      title: 'today all day',
      dueDate: startOfToday,
      dueAllDay: true,
    });
    await env.world.tasks.create({
      title: 'yesterday all day',
      dueDate: startOfToday - 86_400_000,
      dueAllDay: true,
    });
    await env.world.tasks.create({
      title: 'earlier today',
      dueDate: NOW - HOUR,
      dueAllDay: false,
    });
    await env.world.tasks.create({
      title: 'later today',
      dueDate: NOW + HOUR,
      dueAllDay: false,
    });
    await settle();
    expect(screen.getByLabelText('Overdue: 2')).toBeTruthy();
  });

  it('follows data changes and ages with the clock (a task turns overdue)', async () => {
    const env = await renderSignedIn();
    await env.world.tasks.create({
      title: 'due soon',
      dueDate: NOW + 10 * MIN,
      dueAllDay: false,
    });
    await settle();
    expect(screen.getByLabelText('Overdue: 0')).toBeTruthy();
    act(() => env.timer.advance(11 * MIN)); // past the due moment
    await settle();
    expect(screen.getByLabelText('Overdue: 1')).toBeTruthy();
  });
});

describe('active tasks', () => {
  it('lists only in-progress tasks as web-style cards, titled "Active tasks"', async () => {
    const env = await renderSignedIn();
    await seed(env);
    await settle();
    expect(screen.getByRole('header', { name: 'Active tasks' })).toBeTruthy();
    const cards = screen.getAllByTestId(/^task-card-/);
    expect(cards).toHaveLength(1);
    const card = screen.getByRole('button', { name: /^Prepare slides/ });
    expect(within(card).getByText('Prepare slides')).toBeTruthy();
    // Priority badge: the word is translated, never the raw number.
    expect(within(card).getByText('High')).toBeTruthy();
    expect(
      within(card).getByText('Slides for the Friday meeting'),
    ).toBeTruthy();
    expect(
      within(card).getByTestId('status-dot-in_progress', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(screen.queryByText('in_progress')).toBeNull();
  });

  it('shows the ring and the time left, with a spoken equivalent', async () => {
    const env = await renderSignedIn();
    await env.world.tasks.create({
      title: 'Timed',
      status: 'in_progress',
      durationMs: 2 * HOUR,
    });
    await settle();
    expect(screen.getByText('Time left')).toBeTruthy();
    expect(screen.getByText('2 h')).toBeTruthy();
    expect(screen.getByLabelText('2 h left')).toBeTruthy();
    expect(
      screen.getByTestId('countdown-ring', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByText('0%', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it('counts down with the clock from started_at and elapsed_ms (no per-frame animation)', async () => {
    const env = await renderSignedIn();
    await env.world.remoteChanges.applyRemoteChanges({
      cursor: 1,
      tasks: [
        {
          task_id: 'tsk_run',
          list_id: null,
          title: 'Running',
          description: '',
          priority: 0,
          status: 'in_progress',
          due_date: null,
          due_all_day: false,
          duration_ms: 2 * HOUR,
          started_at: NOW - 2 * MIN,
          elapsed_ms: 0,
          completed_at: null,
          sort_order: 0,
          updated_at: 3,
          deleted: false,
        },
      ],
    });
    await settle();
    expect(screen.getByLabelText('1 h 58 min left')).toBeTruthy();
    expect(screen.getByText('1 h 58 min')).toBeTruthy();
    act(() => env.timer.advance(30 * MIN));
    await settle();
    expect(screen.getByLabelText('1 h 28 min left')).toBeTruthy();
    expect(
      screen.getByText('27%', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it('says the time is over once the duration is used up', async () => {
    const env = await renderSignedIn();
    await env.world.remoteChanges.applyRemoteChanges({
      cursor: 1,
      tasks: [
        {
          task_id: 'tsk_over',
          list_id: null,
          title: 'Over',
          description: '',
          priority: 0,
          status: 'in_progress',
          due_date: null,
          due_all_day: false,
          duration_ms: HOUR,
          started_at: NOW - 3 * HOUR,
          elapsed_ms: 0,
          completed_at: null,
          sort_order: 0,
          updated_at: 3,
          deleted: false,
        },
      ],
    });
    await settle();
    expect(screen.getByText('Time over')).toBeTruthy();
    expect(screen.getByLabelText('Time over')).toBeTruthy();
  });

  it('has no timer buttons yet (Pause and Complete come with the task detail)', async () => {
    const env = await renderSignedIn();
    await seed(env);
    await settle();
    expect(
      screen.queryByRole('button', { name: /Pause|Complete$|Start/ }),
    ).toBeNull();
  });

  it('opens the existing task edit screen from a card', async () => {
    const env = await renderSignedIn();
    await seed(env);
    await settle();
    fireEvent.press(screen.getByRole('button', { name: /^Prepare slides/ }));
    expect(
      await screen.findByRole('header', { name: 'Edit task' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Title').props.value).toBe('Prepare slides');
  });

  it('shows an empty state when there are no active tasks', async () => {
    const env = await renderSignedIn();
    await env.world.tasks.create({ title: 'only pending' });
    await settle();
    expect(screen.getByText('No active tasks')).toBeTruthy();
    expect(screen.getByText('Tasks in progress show up here.')).toBeTruthy();
    expect(screen.queryByTestId(/^task-card-/)).toBeNull();
  });

  it('shows a card as soon as a task is in progress (live)', async () => {
    const env = await renderSignedIn();
    await settle();
    expect(screen.getByText('No active tasks')).toBeTruthy();
    await env.world.tasks.create({
      title: 'Now running',
      status: 'in_progress',
    });
    await settle();
    expect(screen.getByRole('button', { name: /^Now running/ })).toBeTruthy();
    expect(screen.queryByText('No active tasks')).toBeNull();
  });

  it('draws an in-progress card with a full accent edge, not a side stripe', async () => {
    const env = await renderSignedIn();
    await env.world.tasks.create({ title: 'Edge', status: 'in_progress' });
    await settle();
    const style = StyleSheet.flatten(
      screen.getByTestId(/^task-card-/).props.style,
    );
    expect(style).toMatchObject({ borderWidth: 1, borderColor: '#007aff' });
    expect(style).not.toHaveProperty('borderLeftWidth');
  });
});

describe('panel in Spanish', () => {
  it('uses the web wording and translated priority', async () => {
    const env = await renderSignedIn({ locale: 'es' });
    await seed(env);
    await settle();
    expect(screen.getByRole('header', { name: 'Panel' })).toBeTruthy();
    expect(screen.getByLabelText('Pendientes: 2')).toBeTruthy();
    expect(screen.getByLabelText('En progreso: 1')).toBeTruthy();
    expect(screen.getByLabelText('Completadas: 1')).toBeTruthy();
    expect(screen.getByLabelText('Vencidas: 1')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Tareas activas' })).toBeTruthy();
    expect(screen.getByText('Alta')).toBeTruthy();
    expect(screen.getByText('Tiempo restante')).toBeTruthy();
    expect(screen.getByLabelText('2 h restantes')).toBeTruthy();
  });

  it('shows the empty state in Spanish', async () => {
    await renderSignedIn({ locale: 'es' });
    await settle();
    expect(screen.getByText('No hay tareas activas')).toBeTruthy();
  });
});

it('shows the discreet sync line under the Panel', async () => {
  const sync = new SyncStatus();
  sync.update({ phase: 'offline', pendingCount: 1 });
  await renderSignedIn({ sync });
  await settle();
  expect(screen.getByText('Offline. 1 change waiting.')).toBeTruthy();
});
