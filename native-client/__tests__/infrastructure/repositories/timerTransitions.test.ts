import { InvalidTransitionError, ValidationError } from '@/domain';
import {
  openTestWorld,
  outboxRows,
  outboxSummary,
  rawRows,
  type TestWorld,
} from '../../helpers/testRepositories';

let w: TestWorld;
beforeEach(async () => {
  w = await openTestWorld();
});
afterEach(() => w.db.close());

const pushAll = async () => {
  const pending = await w.outbox.peekPending(100);
  await w.outbox.markSent(pending.map(e => e.id));
};
const known = async (patch: Record<string, unknown> = {}) => {
  const task = await w.tasks.create({ title: 'a', ...patch });
  await pushAll();
  return task;
};
const ops = async () => (await outboxRows(w.db)).map(r => r.op);

describe('TaskRepository.start', () => {
  it('moves a pending task to in progress at the given moment and queues one start entry', async () => {
    const task = await known();
    w.clock.tick();
    const started = await w.tasks.start(task.id, 5_000);
    expect(started).toMatchObject({
      status: 'in_progress',
      startedAt: 5_000,
      elapsedMs: 0,
      completedAt: null,
      // The row is stamped with the device clock, never with the moment of the tap.
      updatedAt: w.clock.now(),
    });
    expect(await w.tasks.get(task.id)).toEqual(started);
    const rows = await outboxRows(w.db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entity: 'task',
      op: 'start',
      entity_id: task.id,
      status: 'pending',
      origin: 'update',
    });
    expect(JSON.parse(rows[0]!.payload)).toEqual({ at: 5_000 });
    expect(rows[0]!.change_id).toMatch(/^[\x21-\x7e]{1,64}$/);
  });

  it('resumes a paused task without losing what it accumulated', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    await w.tasks.pause(task.id, 4_000);
    const resumed = await w.tasks.start(task.id, 10_000);
    expect(resumed).toMatchObject({
      status: 'in_progress',
      startedAt: 10_000,
      elapsedMs: 3_000,
    });
  });

  it.each([
    ['in_progress', (id: string) => w.tasks.start(id, 1_000)],
    ['completed', (id: string) => w.tasks.complete(id, 1_000)],
  ] as const)(
    'refuses a task that is %s: typed error, row and outbox untouched',
    async (from, prepare) => {
      const task = await known();
      await prepare(task.id);
      await pushAll();
      const before = await rawRows(w.db, 'tasks');
      await expect(w.tasks.start(task.id, 9_000)).rejects.toThrow(
        new InvalidTransitionError('start', from),
      );
      expect(await rawRows(w.db, 'tasks')).toEqual(before);
      expect(await outboxRows(w.db)).toEqual([]);
    },
  );

  it('rejects a moment the backend would refuse, changing nothing', async () => {
    const task = await known();
    await expect(w.tasks.start(task.id, 0)).rejects.toThrow(ValidationError);
    await expect(w.tasks.start(task.id, -5)).rejects.toThrow(ValidationError);
    expect((await w.tasks.get(task.id))?.status).toBe('pending');
    expect(await outboxRows(w.db)).toEqual([]);
  });

  it('resolves null for an unknown or deleted task and queues nothing', async () => {
    expect(await w.tasks.start('tsk_missing', 1_000)).toBeNull();
    const task = await known();
    await w.tasks.delete(task.id);
    await pushAll();
    expect(await w.tasks.start(task.id, 1_000)).toBeNull();
    expect(await outboxRows(w.db)).toEqual([]);
  });
});

describe('TaskRepository.pause', () => {
  it('goes back to pending, adds the segment just run and clears the start', async () => {
    const task = await known();
    await w.tasks.start(task.id, 10_000);
    await pushAll();
    const paused = await w.tasks.pause(task.id, 16_500);
    expect(paused).toMatchObject({
      status: 'pending',
      startedAt: null,
      elapsedMs: 6_500,
    });
    const [row] = await outboxRows(w.db);
    expect(row).toMatchObject({ op: 'pause', entity_id: task.id });
    expect(JSON.parse(row!.payload)).toEqual({ at: 16_500 });
  });

  it('measures from the tap times, not from the clock of the write', async () => {
    const task = await known();
    await w.tasks.start(task.id, 10_000);
    w.clock.tick(3_600_000);
    const paused = await w.tasks.pause(task.id, 12_000);
    expect(paused?.elapsedMs).toBe(2_000);
  });

  it('never goes backwards when the clock is behind the start', async () => {
    const task = await known();
    await w.tasks.start(task.id, 10_000);
    expect((await w.tasks.pause(task.id, 4_000))?.elapsedMs).toBe(0);
  });

  it.each(['pending', 'completed'] as const)(
    'refuses a task that is %s',
    async from => {
      const task = await known();
      if (from === 'completed') {
        await w.tasks.complete(task.id, 1_000);
        await pushAll();
      }
      const before = await rawRows(w.db, 'tasks');
      await expect(w.tasks.pause(task.id, 2_000)).rejects.toThrow(
        new InvalidTransitionError('pause', from),
      );
      expect(await rawRows(w.db, 'tasks')).toEqual(before);
      expect(await outboxRows(w.db)).toEqual([]);
    },
  );

  it('resolves null for a missing task', async () => {
    expect(await w.tasks.pause('tsk_missing', 1_000)).toBeNull();
  });
});

describe('TaskRepository.complete after the timer', () => {
  it('adds the running segment from a start made through the repository', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    const done = await w.tasks.complete(task.id, 4_000);
    expect(done).toMatchObject({
      status: 'completed',
      completedAt: 4_000,
      startedAt: null,
      elapsedMs: 3_000,
    });
  });

  it('completing a paused task keeps its elapsed time', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    await w.tasks.pause(task.id, 3_000);
    const done = await w.tasks.complete(task.id, 99_000);
    expect(done).toMatchObject({ elapsedMs: 2_000, completedAt: 99_000 });
  });

  it('refuses a second completion with a typed error and queues nothing', async () => {
    const task = await known();
    await w.tasks.complete(task.id, 5_000);
    await pushAll();
    await expect(w.tasks.complete(task.id, 9_000)).rejects.toThrow(
      new InvalidTransitionError('complete', 'completed'),
    );
    expect(await outboxRows(w.db)).toEqual([]);
    expect((await w.tasks.get(task.id))?.completedAt).toBe(5_000);
  });
});

describe('the outbox keeps every transition, in order', () => {
  it('start, pause, start, complete are four entries in id order with their own moments and change ids', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    await w.tasks.pause(task.id, 2_000);
    await w.tasks.start(task.id, 3_000);
    await w.tasks.complete(task.id, 4_000);
    const rows = await outboxRows(w.db);
    expect(rows.map(r => r.op)).toEqual([
      'start',
      'pause',
      'start',
      'complete',
    ]);
    expect(rows.map(r => JSON.parse(r.payload).at)).toEqual([
      1_000, 2_000, 3_000, 4_000,
    ]);
    expect(rows.map(r => r.id)).toEqual(
      [...rows.map(r => r.id)].sort((a, b) => a - b),
    );
    expect(new Set(rows.map(r => r.change_id)).size).toBe(4);
    expect(await w.tasks.get(task.id)).toMatchObject({
      status: 'completed',
      elapsedMs: 2_000,
    });
  });

  it('never merges a start with a later pause of the same task', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    await w.tasks.pause(task.id, 2_000);
    expect(await outboxSummary(w.db)).toEqual([
      `task:start:${task.id}`,
      `task:pause:${task.id}`,
    ]);
  });

  it('a pending create stays first, ahead of its transitions, and an edit rewrites it in place', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await w.tasks.start(task.id, 1_000);
    await w.tasks.pause(task.id, 2_000);
    const before = await outboxRows(w.db);
    await w.tasks.update(task.id, { title: 'b' });
    const after = await outboxRows(w.db);
    expect(after.map(r => `${r.op}:${r.id}:${r.change_id}`)).toEqual(
      before.map(r => `${r.op}:${r.id}:${r.change_id}`),
    );
    expect(after.map(r => r.op)).toEqual(['upsert', 'start', 'pause']);
    expect(after[0]).toMatchObject({ origin: 'create' });
  });

  it('describes the task as pending with no start in every upsert, so a create cannot pre-empt the transitions', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await w.tasks.start(task.id, 1_000);
    await w.tasks.update(task.id, { title: 'b' });
    const [upsert] = await outboxRows(w.db);
    expect(JSON.parse(upsert!.payload)).toMatchObject({
      title: 'b',
      status: 'pending',
      started_at: null,
    });
    expect((await w.tasks.get(task.id))?.status).toBe('in_progress');
  });

  it('an edit of a server-known task after a start queues an upsert beside the start', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    await w.tasks.update(task.id, { priority: 2 });
    expect((await ops()).sort()).toEqual(['start', 'upsert']);
  });

  it('deleting a never-pushed task cancels the create and every transition', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await w.tasks.start(task.id, 1_000);
    await w.tasks.pause(task.id, 2_000);
    expect(await w.tasks.delete(task.id)).toBe(true);
    expect(await outboxRows(w.db)).toEqual([]);
    expect(await rawRows(w.db, 'tasks')).toEqual([]);
  });

  it('deleting a server-known task drops its pending transitions and queues one delete', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    await w.tasks.pause(task.id, 2_000);
    await w.tasks.start(task.id, 3_000);
    await w.tasks.update(task.id, { title: 'b' });
    await w.tasks.delete(task.id);
    expect(await outboxSummary(w.db)).toEqual([`task:delete:${task.id}`]);
  });

  it('deleting drops a parked transition too', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    const [entry] = await outboxRows(w.db);
    await w.outbox.park(entry!.id, 'rejected', 'invalid');
    await w.tasks.delete(task.id);
    expect(await outboxSummary(w.db)).toEqual([`task:delete:${task.id}`]);
  });
});

describe('atomicity and notification', () => {
  it('rolls the row back when the outbox write fails', async () => {
    const task = await known();
    await w.db.execute('DROP TABLE outbox');
    await expect(w.tasks.start(task.id, 7_000)).rejects.toThrow();
    expect(await w.tasks.get(task.id)).toMatchObject({
      status: 'pending',
      startedAt: null,
    });
  });

  it.each(['start', 'pause'] as const)(
    'notifies listeners once after a committed %s',
    async op => {
      const task = await known();
      if (op === 'pause') {
        await w.tasks.start(task.id, 1_000);
      }
      const seen = jest.fn();
      w.changes.subscribe(seen);
      w.dataChanges.subscribe(seen);
      await w.tasks[op](task.id, 2_000);
      expect(seen).toHaveBeenCalledTimes(2);
    },
  );

  it('does not notify for a refused transition', async () => {
    const task = await known();
    const seen = jest.fn();
    w.changes.subscribe(seen);
    await expect(w.tasks.pause(task.id, 2_000)).rejects.toThrow();
    expect(seen).not.toHaveBeenCalled();
  });
});

const wireTask = (id: string, extra: Record<string, unknown> = {}) => ({
  user_id: 'u1',
  task_id: id,
  list_id: null,
  title: 'server title',
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
  updated_at: 40,
  deleted: false,
  ...extra,
});

describe('a pull around a task with pending transitions', () => {
  const pull = (id: string, patch: Record<string, unknown>) => ({
    cursor: 50,
    tasks: [wireTask(id, patch)],
  });

  it.each(['start', 'pause'] as const)(
    'never overwrites the local row while a %s is waiting',
    async op => {
      const task = await known();
      await w.tasks.start(task.id, 1_000);
      if (op === 'pause') {
        await w.tasks.pause(task.id, 2_000);
      }
      const local = await w.tasks.get(task.id);
      const result = await w.remoteChanges.applyRemoteChanges(
        pull(task.id, { title: 'server', status: 'pending', elapsed_ms: 0 }),
      );
      expect(result.skippedPending).toBe(1);
      expect(await w.tasks.get(task.id)).toEqual(local);
    },
  );

  it('keeps skipping while only a later transition of a longer sequence is left', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    await w.tasks.pause(task.id, 2_000);
    const [first] = await w.outbox.peekPending(1);
    await w.outbox.markSent([first!.id]);
    const result = await w.remoteChanges.applyRemoteChanges(
      pull(task.id, { status: 'in_progress', started_at: 1_000 }),
    );
    expect(result.skippedPending).toBe(1);
    expect((await w.tasks.get(task.id))?.status).toBe('pending');
  });

  it('applies the server row once the transitions were pushed', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    await w.tasks.pause(task.id, 2_000);
    await pushAll();
    const result = await w.remoteChanges.applyRemoteChanges(
      pull(task.id, { elapsed_ms: 1_000, status: 'pending' }),
    );
    expect(result.applied).toBe(1);
    expect(await w.tasks.get(task.id)).toMatchObject({
      status: 'pending',
      elapsedMs: 1_000,
      startedAt: null,
    });
  });

  it('still skips while a start is parked (the user has not retried it)', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    const [entry] = await outboxRows(w.db);
    await w.outbox.park(entry!.id, 'rejected', 'invalid');
    const result = await w.remoteChanges.applyRemoteChanges(
      pull(task.id, { title: 'server' }),
    );
    expect(result.skippedPending).toBe(1);
  });
});
