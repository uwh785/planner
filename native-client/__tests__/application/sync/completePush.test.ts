import type { OutboxEntry } from '@/application/ports/OutboxRepository';
import { SyncEngine } from '@/application/sync/SyncEngine';
import { classifyResults, toPushChange } from '@/application/sync/pushBatch';
import { FakeSyncServer } from '../../helpers/fakeSyncServer';
import {
  openTestWorld,
  outboxRows,
  type TestWorld,
} from '../../helpers/testRepositories';

const entry = (patch: Partial<OutboxEntry> = {}): OutboxEntry => ({
  id: 1,
  entity: 'task',
  op: 'complete',
  entityId: 'tsk_1',
  payload: { at: 1234 },
  changeId: 'chg_1',
  origin: 'update',
  status: 'pending',
  createdAt: 1,
  attempts: 0,
  lastError: null,
  ...patch,
});

describe('toPushChange for complete', () => {
  it('is the timer op the backend replays: id in the change, {at} in data', () => {
    expect(toPushChange(entry())).toEqual({
      entity: 'task',
      op: 'complete',
      id: 'tsk_1',
      data: { at: 1234 },
      change_id: 'chg_1',
    });
  });
});

describe('classifyResults for complete', () => {
  const answer = (status: string, error?: string) => ({
    data: { results: [{ index: 0, change_id: 'chg_1', status, error }] },
  });
  const outcome = (status: string, error?: string) =>
    classifyResults([entry()], answer(status, error))[0];

  it('clears the entry when applied or replayed', () => {
    expect(outcome('applied')).toEqual({ kind: 'sent' });
    expect(outcome('exists')).toEqual({ kind: 'sent' });
  });

  it('clears the entry on a conflict: the server already has the task completed', () => {
    expect(outcome('conflict', 'task cannot transition')).toEqual({
      kind: 'sent',
    });
  });

  it('retries a few times on not_found (the task may still be on its way), then parks', () => {
    expect(outcome('not_found', 'task not found')).toMatchObject({
      kind: 'retry',
      parkAfter: 5,
    });
  });

  it('parks an invalid moment as rejected so it stays visible', () => {
    expect(outcome('invalid', 'at is too far in the future')).toEqual({
      kind: 'park',
      status: 'rejected',
      error: 'at is too far in the future',
    });
  });

  it('parks a plan limit as blocked', () => {
    expect(outcome('limit')).toMatchObject({ kind: 'park', status: 'blocked' });
  });

  it('still parks a conflicting upsert (an id taken by someone else)', () => {
    const result = classifyResults(
      [entry({ op: 'upsert', payload: {} })],
      answer('conflict'),
    )[0];
    expect(result).toMatchObject({ kind: 'park', status: 'rejected' });
  });
});

describe('the engine pushing a completion', () => {
  let w: TestWorld;
  let server: FakeSyncServer;
  beforeEach(async () => {
    w = await openTestWorld();
    server = new FakeSyncServer();
  });
  afterEach(() => w.db.close());

  const engine = () =>
    new SyncEngine({
      outbox: w.outbox,
      syncState: w.syncState,
      remoteChanges: w.remoteChanges,
      http: server,
      clock: w.clock,
      random: () => 0.5,
    });

  it('pushes a task created and completed offline as upsert then complete, once', async () => {
    const task = await w.tasks.create({ title: 'offline' });
    await w.tasks.complete(task.id, 4_321);
    await engine().sync();
    expect(server.pushes).toHaveLength(1);
    const [create, complete] = server.pushes[0]!;
    expect(create).toMatchObject({ entity: 'task', op: 'upsert', id: task.id });
    expect(create!.data).toMatchObject({ status: 'pending' });
    expect(complete).toEqual({
      entity: 'task',
      op: 'complete',
      id: task.id,
      data: { at: 4_321 },
      change_id: expect.stringMatching(/^chg_/),
    });
    expect(await outboxRows(w.db)).toEqual([]);
    await engine().sync();
    expect(server.pushes).toHaveLength(1);
  });

  it('clears a complete the server refuses as a conflict instead of parking it', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await w.outbox.markSent((await w.outbox.peekPending(9)).map(e => e.id));
    await w.tasks.complete(task.id, 4_321);
    server.rule = c =>
      c.op === 'complete'
        ? { status: 'conflict', error: 'task cannot transition' }
        : undefined;
    await engine().sync();
    expect(await outboxRows(w.db)).toEqual([]);
    expect(await w.outbox.countByStatus()).toEqual({
      pending: 0,
      blocked: 0,
      rejected: 0,
    });
    expect((await w.tasks.get(task.id))?.status).toBe('completed');
  });

  it('keeps a complete pending while the server says not_found, then parks it as blocked', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await w.outbox.markSent((await w.outbox.peekPending(9)).map(e => e.id));
    await w.tasks.complete(task.id, 4_321);
    server.rule = c =>
      c.op === 'complete'
        ? { status: 'not_found', error: 'task not found' }
        : undefined;
    const sync = engine();
    for (let i = 0; i < 5; i += 1) {
      await sync.sync();
    }
    const [row] = await outboxRows(w.db);
    expect(row).toMatchObject({
      op: 'complete',
      status: 'blocked',
      attempts: 5,
    });
  });

  it('a pull after the push keeps the completed row (the server row is completed too)', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await w.tasks.complete(task.id, 4_321);
    server.pullBody = {
      cursor: 200,
      tasks: [
        {
          user_id: 'u',
          task_id: task.id,
          list_id: null,
          title: 'a',
          description: '',
          priority: 0,
          status: 'completed',
          due_date: null,
          due_all_day: false,
          duration_ms: null,
          started_at: null,
          elapsed_ms: 0,
          completed_at: 4_321,
          sort_order: 0,
          updated_at: 150,
          deleted: false,
        },
      ],
    };
    await engine().sync();
    expect(await w.tasks.get(task.id)).toMatchObject({
      status: 'completed',
      completedAt: 4_321,
    });
    expect(await w.outbox.pendingCount()).toBe(0);
  });
});
