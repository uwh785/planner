import type { OutboxEntry } from '@/application/ports/OutboxRepository';
import { SyncEngine } from '@/application/sync/SyncEngine';
import { classifyResults, toPushChange } from '@/application/sync/pushBatch';
import { FakeSyncServer } from '../../helpers/fakeSyncServer';
import {
  openTestWorld,
  outboxRows,
  type TestWorld,
} from '../../helpers/testRepositories';

const entry = (
  op: 'start' | 'pause',
  patch: Partial<OutboxEntry> = {},
): OutboxEntry => ({
  id: 1,
  entity: 'task',
  op,
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

describe('toPushChange for start and pause', () => {
  it.each(['start', 'pause'] as const)(
    'is the timer op the backend replays for %s: id in the change, {at} in data, the change id',
    op => {
      expect(toPushChange(entry(op))).toEqual({
        entity: 'task',
        op,
        id: 'tsk_1',
        data: { at: 1234 },
        change_id: 'chg_1',
      });
    },
  );
});

describe.each(['start', 'pause'] as const)('classifyResults for %s', op => {
  const answer = (status: string, error?: string) => ({
    data: { results: [{ index: 0, change_id: 'chg_1', status, error }] },
  });
  const outcome = (status: string, error?: string) =>
    classifyResults([entry(op)], answer(status, error))[0];

  it('clears the entry when applied or replayed', () => {
    expect(outcome('applied')).toEqual({ kind: 'sent' });
    expect(outcome('exists')).toEqual({ kind: 'sent' });
  });

  it('clears the entry on a conflict: the server task is in another state, and the next pull reconciles', () => {
    expect(outcome('conflict', 'task cannot transition')).toEqual({
      kind: 'sent',
    });
  });

  it('retries not_found a few times, then parks it as blocked', () => {
    expect(outcome('not_found', 'task not found')).toMatchObject({
      kind: 'retry',
      parkAfter: 5,
    });
  });

  it('parks an invalid moment as rejected, keeping the server message', () => {
    expect(outcome('invalid', 'at is too far in the future')).toEqual({
      kind: 'park',
      status: 'rejected',
      error: 'at is too far in the future',
    });
  });

  it('retries a server error with backoff', () => {
    expect(outcome('error', 'boom')).toMatchObject({ kind: 'retry' });
  });
});

describe('the engine pushing timer transitions', () => {
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
  const known = async (patch: Record<string, unknown> = {}) => {
    const task = await w.tasks.create({ title: 'a', ...patch });
    await w.outbox.markSent((await w.outbox.peekPending(9)).map(e => e.id));
    return task;
  };
  const refuse = (op: string, status: string, error: string) => {
    server.rule = c => (c.op === op ? { status, error } : undefined);
  };

  it('pushes start, pause, start, complete in the order they happened, each with its own moment', async () => {
    const task = await w.tasks.create({ title: 'offline' });
    await w.tasks.start(task.id, 1_000);
    await w.tasks.pause(task.id, 2_000);
    await w.tasks.start(task.id, 3_000);
    await w.tasks.complete(task.id, 4_000);
    await engine().sync();
    expect(server.pushes).toHaveLength(1);
    const sent = server.pushes[0]!;
    expect(sent.map(c => `${c.entity}:${c.op}`)).toEqual([
      'task:upsert',
      'task:start',
      'task:pause',
      'task:start',
      'task:complete',
    ]);
    expect(sent.slice(1).map(c => c.data)).toEqual([
      { at: 1_000 },
      { at: 2_000 },
      { at: 3_000 },
      { at: 4_000 },
    ]);
    expect(sent[0]!.data).toMatchObject({
      status: 'pending',
      started_at: null,
    });
    expect(new Set(sent.map(c => c.change_id)).size).toBe(5);
    expect(await outboxRows(w.db)).toEqual([]);
  });

  it('sends nothing twice: a second sync after the push has no changes to send', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    await engine().sync();
    await engine().sync();
    expect(server.pushes).toHaveLength(1);
  });

  it('a lost response replays the same change ids and the server answers exists', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    await w.tasks.pause(task.id, 2_000);
    server.failNext = method => (method === 'GET' ? new Error('lost') : null);
    await engine().sync();
    // The push went through but the pull failed; the entries are gone, nothing resends.
    expect(await outboxRows(w.db)).toEqual([]);
    expect(server.pushes).toHaveLength(1);
    expect(server.applied).toHaveLength(2);
  });

  it.each(['start', 'pause'] as const)(
    'clears a %s the server refuses as a conflict and lets the pull reconcile',
    async op => {
      const task = await known();
      await w.tasks.start(task.id, 1_000);
      if (op === 'pause') {
        await w.tasks.pause(task.id, 2_000);
      }
      refuse(op, 'conflict', 'task cannot transition');
      // The server already completed the task from another device.
      server.pullBody = {
        cursor: 300,
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
            elapsed_ms: 9_000,
            completed_at: 8_000,
            sort_order: 0,
            updated_at: 250,
            deleted: false,
          },
        ],
      };
      await engine().sync();
      expect(await outboxRows(w.db)).toEqual([]);
      expect(await w.outbox.countByStatus()).toEqual({
        pending: 0,
        blocked: 0,
        rejected: 0,
      });
      expect(await w.tasks.get(task.id)).toMatchObject({
        status: 'completed',
        completedAt: 8_000,
        elapsedMs: 9_000,
      });
    },
  );

  it('keeps a start pending while the server says not_found, then parks it as blocked', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    refuse('start', 'not_found', 'task not found');
    const sync = engine();
    for (let i = 0; i < 5; i += 1) {
      await sync.sync();
    }
    const [row] = await outboxRows(w.db);
    expect(row).toMatchObject({ op: 'start', status: 'blocked', attempts: 5 });
    expect((await w.tasks.get(task.id))?.status).toBe('in_progress');
  });

  it('parks a pause with an invalid moment as rejected and keeps the local row', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    await w.tasks.pause(task.id, 2_000);
    refuse('pause', 'invalid', 'at is too far in the future');
    await engine().sync();
    const rows = await outboxRows(w.db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      op: 'pause',
      status: 'rejected',
      last_error: 'at is too far in the future',
    });
    expect(await w.tasks.get(task.id)).toMatchObject({
      status: 'pending',
      elapsedMs: 1_000,
    });
  });

  it('a pull after a successful push keeps the elapsed time the server computed', async () => {
    const task = await known();
    await w.tasks.start(task.id, 1_000);
    await w.tasks.pause(task.id, 6_000);
    server.pullBody = {
      cursor: 300,
      tasks: [
        {
          user_id: 'u',
          task_id: task.id,
          list_id: null,
          title: 'a',
          description: '',
          priority: 0,
          status: 'pending',
          due_date: null,
          due_all_day: false,
          duration_ms: null,
          started_at: null,
          elapsed_ms: 5_000,
          completed_at: null,
          sort_order: 0,
          updated_at: 250,
          deleted: false,
        },
      ],
    };
    await engine().sync();
    expect(await w.tasks.get(task.id)).toMatchObject({
      status: 'pending',
      elapsedMs: 5_000,
      startedAt: null,
    });
  });
});
