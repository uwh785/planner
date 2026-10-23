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

describe('TaskRepository.complete', () => {
  it('marks the task completed with the given moment and queues one complete entry', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await pushAll();
    w.clock.tick();
    const done = await w.tasks.complete(task.id, 5_555);
    expect(done).toMatchObject({
      id: task.id,
      status: 'completed',
      completedAt: 5_555,
      startedAt: null,
      updatedAt: w.clock.now(),
    });
    expect((await w.tasks.get(task.id))?.status).toBe('completed');
    const rows = await outboxRows(w.db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entity: 'task',
      op: 'complete',
      entity_id: task.id,
      status: 'pending',
      origin: 'update',
    });
    expect(JSON.parse(rows[0]!.payload)).toEqual({ at: 5_555 });
    expect(rows[0]!.change_id).toMatch(/^[\x21-\x7e]{1,64}$/);
  });

  it('adds the running segment to elapsed time when the task was in progress', async () => {
    const task = await w.tasks.create({ title: 'a', status: 'in_progress' });
    await w.db.execute(
      'UPDATE tasks SET started_at = ?, elapsed_ms = 100 WHERE task_id = ?',
      [1_000, task.id],
    );
    const done = await w.tasks.complete(task.id, 4_000);
    expect(done).toMatchObject({
      status: 'completed',
      startedAt: null,
      elapsedMs: 3_100,
    });
  });

  it('is a no-op the second time: same row, no second entry', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await pushAll();
    const first = await w.tasks.complete(task.id, 5_000);
    w.clock.tick();
    const second = await w.tasks.complete(task.id, 9_000);
    expect(second).toEqual(first);
    expect(second?.completedAt).toBe(5_000);
    expect(await w.outbox.pendingCount()).toBe(1);
  });

  it('resolves null for an unknown or deleted task and queues nothing', async () => {
    expect(await w.tasks.complete('tsk_missing', 1)).toBeNull();
    const task = await w.tasks.create({ title: 'a' });
    await pushAll();
    await w.tasks.delete(task.id);
    await pushAll();
    expect(await w.tasks.complete(task.id, 1)).toBeNull();
    expect(await outboxRows(w.db)).toEqual([]);
  });

  it('keeps a pending create as upsert then complete, in that order, with a pending body', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await w.tasks.complete(task.id, 7_000);
    expect(await outboxSummary(w.db)).toEqual([
      `task:upsert:${task.id}`,
      `task:complete:${task.id}`,
    ]);
    const [upsert] = await outboxRows(w.db);
    expect(upsert).toMatchObject({ origin: 'create' });
    expect(JSON.parse(upsert!.payload).status).toBe('pending');
  });

  it('an edit after completing rewrites the upsert in place and never changes the complete entry', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await w.tasks.complete(task.id, 7_000);
    const before = await outboxRows(w.db);
    await w.tasks.update(task.id, { title: 'b' });
    const after = await outboxRows(w.db);
    expect(after.map(r => `${r.op}:${r.id}:${r.change_id}`)).toEqual(
      before.map(r => `${r.op}:${r.id}:${r.change_id}`),
    );
    const body = JSON.parse(after[0]!.payload);
    expect(body).toMatchObject({ title: 'b', status: 'pending' });
    expect((await w.tasks.get(task.id))?.status).toBe('completed');
  });

  it('an edit of a completed task the server knows queues an upsert that never reopens it', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await pushAll();
    await w.tasks.complete(task.id, 7_000);
    await w.tasks.update(task.id, { priority: 2 });
    const rows = await outboxRows(w.db);
    expect(rows.map(r => r.op).sort()).toEqual(['complete', 'upsert']);
    const upsert = rows.find(r => r.op === 'upsert')!;
    expect(JSON.parse(upsert.payload)).toMatchObject({
      priority: 2,
      status: 'pending',
    });
  });

  it('deleting a never-pushed completed task cancels every entry', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await w.tasks.complete(task.id, 7_000);
    expect(await w.tasks.delete(task.id)).toBe(true);
    expect(await outboxRows(w.db)).toEqual([]);
    expect(await rawRows(w.db, 'tasks')).toEqual([]);
  });

  it('deleting a server-known task drops its pending complete and queues one delete', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await pushAll();
    await w.tasks.complete(task.id, 7_000);
    await w.tasks.update(task.id, { title: 'b' });
    await w.tasks.delete(task.id);
    expect(await outboxSummary(w.db)).toEqual([`task:delete:${task.id}`]);
  });

  it('deleting a task whose complete entry is parked drops it too', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await pushAll();
    await w.tasks.complete(task.id, 7_000);
    const [entry] = await outboxRows(w.db);
    await w.outbox.park(entry!.id, 'rejected', 'invalid');
    await w.tasks.delete(task.id);
    expect(await outboxSummary(w.db)).toEqual([`task:delete:${task.id}`]);
  });

  it('a parked complete stays parked and is not duplicated by another complete', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await pushAll();
    await w.tasks.complete(task.id, 7_000);
    const [entry] = await outboxRows(w.db);
    await w.outbox.park(entry!.id, 'blocked', 'missing');
    await w.tasks.complete(task.id, 8_000);
    const rows = await outboxRows(w.db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: entry!.id, status: 'blocked' });
    expect(JSON.parse(rows[0]!.payload)).toEqual({ at: 7_000 });
  });

  it('rolls the row back when the outbox write fails', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await pushAll();
    await w.db.execute('DROP TABLE outbox');
    await expect(w.tasks.complete(task.id, 7_000)).rejects.toThrow();
    expect((await w.tasks.get(task.id))?.status).toBe('pending');
  });

  it('notifies listeners after the commit', async () => {
    const task = await w.tasks.create({ title: 'a' });
    const seen = jest.fn();
    w.changes.subscribe(seen);
    w.dataChanges.subscribe(seen);
    await w.tasks.complete(task.id, 7_000);
    expect(seen).toHaveBeenCalledTimes(2);
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

describe('a pull around a completed task', () => {
  const pullTask = (patch: Record<string, unknown>, id: string) => ({
    cursor: 50,
    tasks: [wireTask(id, patch)],
  });

  it('does not resurrect or overwrite a locally completed row with a pending complete', async () => {
    const task = await w.tasks.create({ title: 'mine' });
    await pushAll();
    await w.tasks.complete(task.id, 7_000);
    const result = await w.remoteChanges.applyRemoteChanges(
      pullTask({ status: 'pending' }, task.id),
    );
    expect(result.skippedPending).toBe(1);
    expect(await w.tasks.get(task.id)).toMatchObject({
      title: 'mine',
      status: 'completed',
      completedAt: 7_000,
    });
  });

  it('applies a completed server row normally', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await pushAll();
    const result = await w.remoteChanges.applyRemoteChanges(
      pullTask({ status: 'completed', completed_at: 9_000 }, task.id),
    );
    expect(result.applied).toBe(1);
    expect(await w.tasks.get(task.id)).toMatchObject({
      status: 'completed',
      completedAt: 9_000,
    });
  });

  it('reconciles to the server row once the complete was pushed', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await pushAll();
    await w.tasks.complete(task.id, 7_000);
    await pushAll();
    await w.remoteChanges.applyRemoteChanges(
      pullTask(
        { status: 'completed', completed_at: 7_000, title: 'a' },
        task.id,
      ),
    );
    expect(await w.tasks.get(task.id)).toMatchObject({
      status: 'completed',
      completedAt: 7_000,
    });
  });
});

describe('remote changes notify the data feed but not the push feed', () => {
  it('fires dataChanges only when something was applied', async () => {
    const data = jest.fn();
    const local = jest.fn();
    w.dataChanges.subscribe(data);
    w.changes.subscribe(local);
    await w.remoteChanges.applyRemoteChanges({ cursor: 1 });
    expect(data).not.toHaveBeenCalled();
    await w.remoteChanges.applyRemoteChanges({
      cursor: 2,
      tasks: [wireTask('tsk_r1', { title: 'remote' })],
    });
    expect(data).toHaveBeenCalledTimes(1);
    expect(local).not.toHaveBeenCalled();
  });
});
