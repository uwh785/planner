import {
  openTestWorld,
  outboxRows,
  type TestWorld,
} from '../../helpers/testRepositories';

let w: TestWorld;
beforeEach(async () => {
  w = await openTestWorld();
});
afterEach(() => w.db.close());

describe('OutboxRepository', () => {
  it('peeks pending entries oldest first with parsed payloads', async () => {
    const a = await w.taskLists.create({ name: 'a' });
    const b = await w.tasks.create({ title: 'b' });
    const entries = await w.outbox.peekPending(10);
    expect(entries.map(e => e.entityId)).toEqual([a.id, b.id]);
    expect(entries[0]).toMatchObject({
      entity: 'list',
      op: 'upsert',
      origin: 'create',
      attempts: 0,
      lastError: null,
      payload: { name: 'a' },
    });
    expect(await w.outbox.peekPending(1)).toHaveLength(1);
    expect(await w.outbox.peekPending(0)).toEqual([]);
  });

  it('marks entries sent (they leave the queue) and counts pending', async () => {
    await w.tasks.create({ title: 'a' });
    await w.tasks.create({ title: 'b' });
    const [first] = await w.outbox.peekPending(1);
    expect(await w.outbox.pendingCount()).toBe(2);
    await w.outbox.markSent([first!.id]);
    expect(await w.outbox.pendingCount()).toBe(1);
    await w.outbox.markSent([]);
    expect(await w.outbox.pendingCount()).toBe(1);
  });

  it('records a failure without losing the entry', async () => {
    await w.tasks.create({ title: 'a' });
    const [entry] = await w.outbox.peekPending(1);
    await w.outbox.markFailed(entry!.id, 'HTTP 500');
    await w.outbox.markFailed(entry!.id, 'HTTP 503');
    const [again] = await w.outbox.peekPending(1);
    expect(again).toMatchObject({ attempts: 2, lastError: 'HTTP 503' });
    expect(await w.outbox.pendingCount()).toBe(1);
  });

  it('looks pending entries up by entity (used by pull)', async () => {
    const t = await w.tasks.create({ title: 'a' });
    await w.tags.create({ name: 'g' });
    const tasks = await w.outbox.pendingByEntity('task');
    expect(tasks.map(e => e.entityId)).toEqual([t.id]);
  });

  it('keeps unique, valid change ids', async () => {
    for (let i = 0; i < 5; i += 1) {
      await w.tasks.create({ title: `t${i}` });
    }
    const ids = (await outboxRows(w.db)).map(r => r.change_id);
    expect(new Set(ids).size).toBe(5);
    ids.forEach(id => expect(id).toMatch(/^[\x21-\x7e]{1,64}$/));
  });
});

describe('SyncStateRepository', () => {
  it('defaults to cursor 0 and no last sync', async () => {
    expect(await w.syncState.getCursor()).toBe(0);
    expect(await w.syncState.getLastSyncAt()).toBeNull();
  });

  it('round-trips the cursor and last sync time, overwriting', async () => {
    await w.syncState.setCursor(123);
    await w.syncState.setCursor(456);
    await w.syncState.setLastSyncAt(789);
    expect(await w.syncState.getCursor()).toBe(456);
    expect(await w.syncState.getLastSyncAt()).toBe(789);
  });
});
