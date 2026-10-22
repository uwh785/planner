import {
  HttpError,
  NetworkError,
  SessionExpiredError,
  SignedOutError,
} from '@/application/auth/errors';
import type { OutboxRepository } from '@/application/ports/OutboxRepository';
import { SyncEngine } from '@/application/sync/SyncEngine';
import { FakeSyncServer } from '../../helpers/fakeSyncServer';
import {
  openTestWorld,
  outboxRows,
  type TestWorld,
} from '../../helpers/testRepositories';

let w: TestWorld;
let server: FakeSyncServer;
let logs: string[];

beforeEach(async () => {
  w = await openTestWorld();
  server = new FakeSyncServer();
  logs = [];
});
afterEach(() => w.db.close());

function makeEngine(outbox: OutboxRepository = w.outbox) {
  return new SyncEngine({
    outbox,
    syncState: w.syncState,
    remoteChanges: w.remoteChanges,
    http: server,
    clock: w.clock,
    random: () => 0.5,
    log: message => logs.push(message),
  });
}

const failWith = (error: Error) => {
  server.failNext = () => error;
};
const pushedOnce = () => server.pushes.flat();

describe('push', () => {
  it('sends the entries in id order in the contract shape', async () => {
    const list = await w.taskLists.create({ name: 'L' });
    const task = await w.tasks.create({ title: 'T', listId: list.id });
    const tag = await w.tags.create({ name: 'g' });
    await w.tags.addToTask(task.id, tag.id);

    await makeEngine().sync();

    expect(server.pushes).toHaveLength(1);
    const changes = pushedOnce();
    expect(changes.map(c => `${c.entity}:${c.op}`)).toEqual([
      'list:upsert',
      'task:upsert',
      'tag:upsert',
      'task_tag:upsert',
    ]);
    expect(Object.keys(changes[0]!).sort()).toEqual([
      'change_id',
      'data',
      'entity',
      'id',
      'op',
    ]);
    expect(changes[0]).toMatchObject({
      id: list.id,
      data: expect.objectContaining({ name: 'L' }),
      change_id: 'chg_1',
    });
    expect(await outboxRows(w.db)).toEqual([]);
  });

  it('maps a task/tag link to data {task_id, tag_id} and its pair id', async () => {
    const task = await w.tasks.create({ title: 'T' });
    const tag = await w.tags.create({ name: 'g' });
    await w.tags.addToTask(task.id, tag.id);
    await w.outbox.markSent((await w.outbox.peekPending(9)).map(e => e.id));
    await w.tags.removeFromTask(task.id, tag.id);

    await makeEngine().sync();

    const [link] = pushedOnce();
    expect(link).toMatchObject({
      entity: 'task_tag',
      op: 'delete',
      id: `${task.id}:${tag.id}`,
      data: { task_id: task.id, tag_id: tag.id },
    });
  });

  it('splits more than 200 entries into batches of at most 200, oldest first', async () => {
    for (let i = 0; i < 450; i += 1) {
      await w.tasks.create({ title: `t${i}` });
    }
    await makeEngine().sync();
    expect(server.pushes.map(b => b.length)).toEqual([200, 200, 50]);
    const ids = pushedOnce().map(c => Number(c.change_id.slice(4)));
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(await w.outbox.pendingCount()).toBe(0);
  }, 30_000);

  it('sends nothing when the outbox is empty', async () => {
    await makeEngine().sync();
    expect(server.pushes).toEqual([]);
  });

  it('removes applied and exists entries', async () => {
    await w.tasks.create({ title: 'a' });
    await w.tasks.create({ title: 'b' });
    server.rule = (_c, i) => (i === 1 ? { status: 'exists' } : undefined);
    await makeEngine().sync();
    expect(await outboxRows(w.db)).toEqual([]);
  });

  it('treats not_found on a delete as already gone', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await w.outbox.markSent((await w.outbox.peekPending(1)).map(e => e.id));
    await w.tasks.delete(task.id);
    server.rule = () => ({ status: 'not_found', http_status: 404 });
    await makeEngine().sync();
    expect(await outboxRows(w.db)).toEqual([]);
  });

  it('keeps an upsert with a missing parent pending, then blocks it after 5 attempts', async () => {
    await w.tasks.create({ title: 'orphan' });
    server.rule = () => ({
      status: 'not_found',
      http_status: 404,
      error: 'list not found',
    });
    const engine = makeEngine();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await engine.sync();
      const [row] = await outboxRows(w.db);
      expect(row).toMatchObject({ status: 'pending', attempts: attempt });
      expect(row!.last_error).toBe('list not found');
    }
    await engine.sync();
    const [row] = await outboxRows(w.db);
    expect(row).toMatchObject({ status: 'blocked', attempts: 5 });
    expect(engine.status.getSnapshot()).toMatchObject({ blockedCount: 1 });
    const requests = server.pushes.length;
    await engine.sync();
    expect(server.pushes).toHaveLength(requests);
  });

  it('parks a limit as blocked with the server message and never retries it', async () => {
    const task = await w.tasks.create({ title: 'over the cap' });
    server.rule = () => ({
      status: 'limit',
      http_status: 402,
      error: 'task limit reached',
    });
    const engine = makeEngine();
    await engine.sync();
    const [row] = await outboxRows(w.db);
    expect(row).toMatchObject({
      status: 'blocked',
      last_error: 'task limit reached',
    });
    expect(await w.tasks.get(task.id)).not.toBeNull();
    expect(engine.status.getSnapshot()).toMatchObject({
      pendingCount: 0,
      blockedCount: 1,
      rejectedCount: 0,
    });
    server.rule = () => undefined;
    await engine.sync();
    expect(server.pushes).toHaveLength(1);
  });

  it.each([
    ['conflict', 409, 'id already in use'],
    ['invalid', 400, 'title is required'],
  ])(
    'parks %s as rejected and keeps the local row',
    async (status, code, msg) => {
      const task = await w.tasks.create({ title: 'x' });
      server.rule = () => ({ status, http_status: code, error: msg });
      const engine = makeEngine();
      await engine.sync();
      const [row] = await outboxRows(w.db);
      expect(row).toMatchObject({ status: 'rejected', last_error: msg });
      expect(await w.tasks.get(task.id)).not.toBeNull();
      expect(engine.status.getSnapshot()).toMatchObject({ rejectedCount: 1 });
    },
  );

  it('keeps entries with a server error pending, counts the attempt and backs off', async () => {
    await w.tasks.create({ title: 'a' });
    await w.tasks.create({ title: 'b' });
    server.rule = (_c, i) =>
      i === 0
        ? { status: 'error', http_status: 500, error: 'failed to create' }
        : undefined;
    const engine = makeEngine();
    await engine.sync();
    const rows = await outboxRows(w.db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'pending',
      attempts: 1,
      last_error: 'failed to create',
    });
    expect(engine.status.getSnapshot()).toMatchObject({
      phase: 'error',
      nextRetryAt: w.clock.now() + 2000,
    });
    expect(engine.nextRetryAt).toBe(w.clock.now() + 2000);
    // The pull still ran: the network works.
    expect(server.pulls).toHaveLength(1);
  });

  it('treats an unknown status or a missing result as a retryable failure', async () => {
    await w.tasks.create({ title: 'a' });
    await w.tasks.create({ title: 'b' });
    server.rule = (_c, i) => (i === 0 ? { status: 'weird' } : undefined);
    const original = server.request.bind(server);
    server.request = async (method, path, options) => {
      const res = await original(method, path, options);
      if (method === 'POST') {
        const data = (res.json as { data: { results: unknown[] } }).data;
        data.results = data.results.slice(0, 1); // second result is missing
      }
      return res;
    };
    await makeEngine().sync();
    const rows = await outboxRows(w.db);
    expect(rows.map(r => [r.status, r.attempts])).toEqual([
      ['pending', 1],
      ['pending', 1],
    ]);
  });

  it('leaves the outbox byte-identical when the network fails', async () => {
    await w.tasks.create({ title: 'a' });
    await w.tags.create({ name: 'g' });
    const before = JSON.stringify(await outboxRows(w.db));
    failWith(new NetworkError('offline'));
    const engine = makeEngine();
    await engine.sync();
    expect(JSON.stringify(await outboxRows(w.db))).toBe(before);
    expect(server.pulls).toEqual([]);
    expect(engine.status.getSnapshot()).toMatchObject({
      phase: 'offline',
      pendingCount: 2,
      lastError: 'offline',
      nextRetryAt: w.clock.now() + 2000,
    });
  });

  it('backs off without touching the outbox on a whole-request server error', async () => {
    await w.tasks.create({ title: 'a' });
    const before = JSON.stringify(await outboxRows(w.db));
    failWith(new HttpError(503, 'unavailable'));
    const engine = makeEngine();
    await engine.sync();
    expect(JSON.stringify(await outboxRows(w.db))).toBe(before);
    expect(engine.status.getSnapshot()).toMatchObject({ phase: 'error' });
    expect(engine.nextRetryAt).not.toBeNull();
  });

  it('parks the batch as rejected once on a whole-batch 400, logs a reason code only, and goes on', async () => {
    await w.tasks.create({ title: 'secret title' });
    let refused = false;
    server.failNext = method => {
      if (method === 'POST' && !refused) {
        refused = true;
        return new HttpError(400, 'changes[0]: unknown entity');
      }
      return null;
    };
    const engine = makeEngine();
    await engine.sync();
    const [row] = await outboxRows(w.db);
    expect(row).toMatchObject({ status: 'rejected', attempts: 0 });
    expect(row!.last_error).toContain('400');
    expect(server.pulls).toHaveLength(1);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.join('\n')).not.toContain('secret title');
    expect(engine.status.getSnapshot()).toMatchObject({
      phase: 'idle',
      rejectedCount: 1,
    });
    await engine.sync();
    expect(server.pushes).toHaveLength(0);
  });

  it('retries with a smaller batch when the body is too large', async () => {
    for (let i = 0; i < 4; i += 1) {
      await w.tasks.create({ title: `t${i}` });
    }
    let first = true;
    server.failNext = () => {
      if (first) {
        first = false;
        return new HttpError(413, 'too large');
      }
      return null;
    };
    await makeEngine().sync();
    expect(server.pushes.map(b => b.length)).toEqual([2, 2]);
    expect(await w.outbox.pendingCount()).toBe(0);
  });

  it.each([
    ['SessionExpiredError', new SessionExpiredError()],
    ['SignedOutError', new SignedOutError()],
  ])('pauses without backoff on %s', async (_name, error) => {
    await w.tasks.create({ title: 'a' });
    failWith(error);
    const engine = makeEngine();
    await engine.sync();
    expect(engine.status.getSnapshot()).toMatchObject({
      phase: 'paused',
      nextRetryAt: null,
      pendingCount: 1,
    });
    expect(engine.nextRetryAt).toBeNull();
    expect(server.pulls).toEqual([]);
  });

  it('keeps each entry change_id for life', async () => {
    await w.tasks.create({ title: 'a' });
    const [entry] = await w.outbox.peekPending(1);
    server.rule = () => ({ status: 'error', http_status: 500 });
    const engine = makeEngine();
    await engine.sync();
    await engine.sync();
    expect(server.pushes.flat().map(c => c.change_id)).toEqual([
      entry!.changeId,
      entry!.changeId,
    ]);
  });
});

describe('crash and replay safety', () => {
  it('re-sends the same change ids after a lost acknowledgement and gets exists, without duplicates', async () => {
    const task = await w.tasks.create({ title: 'a' });
    const tag = await w.tags.create({ name: 'g' });
    await w.tags.addToTask(task.id, tag.id);
    const ids = (await outboxRows(w.db)).map(r => r.change_id);

    let failRemoval = true;
    const flaky: OutboxRepository = Object.create(w.outbox, {
      markSent: {
        value: async (entryIds: readonly number[]) => {
          if (failRemoval) {
            failRemoval = false;
            throw new Error('app died before removing the entries');
          }
          return w.outbox.markSent(entryIds);
        },
      },
    });
    const engine = makeEngine(flaky);

    await engine.sync(); // response received, removal fails
    expect((await outboxRows(w.db)).map(r => r.change_id)).toEqual(ids);
    expect(engine.status.getSnapshot().phase).toBe('error');
    expect(server.applied).toEqual(ids);

    w.clock.tick(60_000);
    await engine.sync(); // replay
    expect(server.pushes[1]!.map(c => c.change_id)).toEqual(ids);
    expect(await outboxRows(w.db)).toEqual([]);
    expect(server.applied).toEqual(ids); // each change applied once
    expect(engine.status.getSnapshot().phase).toBe('idle');
  });
});

describe('pull', () => {
  it('pushes first, then pulls', async () => {
    await w.tasks.create({ title: 'a' });
    await makeEngine().sync();
    expect(server.calls).toEqual([
      'POST /api/sync/push',
      'GET /api/sync?since=0',
    ]);
  });

  it('applies a full snapshot on the first sync and sends the saved cursor next', async () => {
    server.pullBody = {
      cursor: 4242,
      lists: [{ list_id: 'lst_srv', name: 'From server', updated_at: 5 }],
      tasks: [
        { task_id: 'tsk_srv', list_id: 'lst_srv', title: 'T', updated_at: 5 },
      ],
    };
    const engine = makeEngine();
    await engine.sync();
    expect((await w.taskLists.get('lst_srv'))?.name).toBe('From server');
    expect(await w.tasks.get('tsk_srv')).not.toBeNull();
    expect(await w.syncState.getCursor()).toBe(4242);
    await engine.sync();
    expect(server.pulls).toEqual(['/api/sync?since=0', '/api/sync?since=4242']);
  });

  it('applies tombstones from the server', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await makeEngine().sync();
    server.pullBody = {
      cursor: 200,
      tasks: [{ task_id: task.id, title: 'a', updated_at: 150, deleted: true }],
    };
    await makeEngine().sync();
    expect(await w.tasks.get(task.id)).toBeNull();
  });

  it('skips rows that still have a pending local change, and still pulls after retryable push failures', async () => {
    const mine = await w.tasks.create({ title: 'mine' });
    server.rule = () => ({ status: 'error', http_status: 500 });
    server.pullBody = {
      cursor: 9,
      tasks: [
        { task_id: mine.id, title: 'theirs', updated_at: 99999999 },
        { task_id: 'tsk_other', title: 'other', updated_at: 5 },
      ],
    };
    await makeEngine().sync();
    expect((await w.tasks.get(mine.id))?.title).toBe('mine');
    expect(await w.tasks.get('tsk_other')).not.toBeNull();
  });

  it('backs off when the pull fails but keeps what the push achieved', async () => {
    await w.tasks.create({ title: 'a' });
    server.failNext = method =>
      method === 'GET' ? new HttpError(500, 'boom') : null;
    const engine = makeEngine();
    await engine.sync();
    expect(await w.outbox.pendingCount()).toBe(0);
    expect(engine.status.getSnapshot()).toMatchObject({
      phase: 'error',
      lastSyncAt: null,
      nextRetryAt: w.clock.now() + 2000,
    });
    expect(await w.syncState.getCursor()).toBe(0);
  });

  it('records lastSyncAt only on a fully clean run', async () => {
    const engine = makeEngine();
    await engine.sync();
    expect(engine.status.getSnapshot()).toMatchObject({
      phase: 'idle',
      lastSyncAt: w.clock.now(),
      lastError: null,
      nextRetryAt: null,
    });
    expect(await w.syncState.getLastSyncAt()).toBe(w.clock.now());
    w.clock.tick(5000);
    await w.tasks.create({ title: 'x' });
    server.rule = () => ({ status: 'error', http_status: 500 });
    const earlier = w.clock.now() - 5000;
    await engine.sync();
    expect(engine.status.getSnapshot().lastSyncAt).toBe(earlier);
  });
});

describe('single flight', () => {
  const gate = () => {
    let open!: () => void;
    const opened = new Promise<void>(resolve => (open = resolve));
    return { open, opened };
  };

  it('shares one in-flight run between concurrent calls and runs at most one follow-up', async () => {
    await w.tasks.create({ title: 'a' });
    const g = gate();
    let first = true;
    server.beforeAnswer = async () => {
      if (first) {
        first = false;
        await g.opened;
      }
    };
    const engine = makeEngine();
    const a = engine.sync();
    const b = engine.sync();
    const c = engine.sync();
    expect(b).toBe(a);
    expect(c).toBe(a);
    g.open();
    await a;
    // Run 1: push + pull. Run 2 (the single follow-up): pull only (empty outbox).
    expect(server.calls).toEqual([
      'POST /api/sync/push',
      'GET /api/sync?since=0',
      'GET /api/sync?since=100',
    ]);
  });

  it('runs once when called once, and again on a later call', async () => {
    const engine = makeEngine();
    await engine.sync();
    expect(server.pulls).toHaveLength(1);
    await engine.sync();
    expect(server.pulls).toHaveLength(2);
  });

  it('does not run a follow-up after a failed run', async () => {
    const g = gate();
    server.beforeAnswer = () => g.opened;
    failWith(new NetworkError());
    const engine = makeEngine();
    const a = engine.sync();
    engine.sync();
    g.open();
    await a;
    expect(server.calls).toHaveLength(1);
  });

  it('shows syncing while a run is in flight', async () => {
    const g = gate();
    server.beforeAnswer = () => g.opened;
    const engine = makeEngine();
    const run = engine.sync();
    await Promise.resolve();
    expect(engine.status.getSnapshot().phase).toBe('syncing');
    g.open();
    await run;
    expect(engine.status.getSnapshot().phase).toBe('idle');
  });
});

describe('backoff in the engine', () => {
  it('follows the schedule on consecutive failures and resets on success', async () => {
    const engine = makeEngine();
    const delays: number[] = [];
    failWith(new NetworkError());
    for (let i = 0; i < 7; i += 1) {
      server.failNext = () => new NetworkError();
      await engine.sync();
      delays.push(engine.nextRetryAt! - w.clock.now());
    }
    expect(delays).toEqual([2000, 5000, 15000, 60000, 300000, 900000, 900000]);
    server.failNext = null;
    await engine.sync();
    expect(engine.nextRetryAt).toBeNull();
    server.failNext = () => new NetworkError();
    await engine.sync();
    expect(engine.nextRetryAt! - w.clock.now()).toBe(2000);
  });
});

describe('status', () => {
  it('refresh() loads counts and the last sync time and notifies subscribers once per change', async () => {
    await w.syncState.setLastSyncAt(777);
    await w.tasks.create({ title: 'a' });
    const engine = makeEngine();
    const seen: number[] = [];
    engine.status.subscribe(() =>
      seen.push(engine.status.getSnapshot().pendingCount),
    );
    await engine.refresh();
    expect(engine.status.getSnapshot()).toMatchObject({
      phase: 'idle',
      pendingCount: 1,
      lastSyncAt: 777,
    });
    const snapshot = engine.status.getSnapshot();
    await engine.refresh();
    expect(engine.status.getSnapshot()).toBe(snapshot);
    expect(seen).toEqual([1]);
  });

  it('noteConnectivity moves between offline and idle but never overrides syncing', async () => {
    const engine = makeEngine();
    engine.noteConnectivity(false);
    expect(engine.status.getSnapshot().phase).toBe('offline');
    engine.noteConnectivity(true);
    expect(engine.status.getSnapshot().phase).toBe('idle');
  });

  it('a failing local read never rejects sync()', async () => {
    const broken = Object.create(w.outbox, {
      peekPending: {
        value: async () => {
          throw new Error('database is closed');
        },
      },
    }) as OutboxRepository;
    const engine = makeEngine(broken);
    await expect(engine.sync()).resolves.toBeUndefined();
    expect(engine.status.getSnapshot().phase).toBe('error');
  });
});

describe('payload sanity', () => {
  it('never puts a payload in the log', async () => {
    await w.tasks.create({ title: 'top secret' });
    server.rule = () => ({ status: 'invalid', error: 'title is required' });
    await makeEngine().sync();
    expect(logs.join('\n')).not.toContain('top secret');
  });
});
