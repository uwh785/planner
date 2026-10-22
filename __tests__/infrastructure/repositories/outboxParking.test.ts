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

const firstId = async () => (await outboxRows(w.db))[0]!.id;

describe('outbox statuses', () => {
  it('peekPending only returns pending entries', async () => {
    await w.tasks.create({ title: 'a' });
    await w.tasks.create({ title: 'b' });
    const [a] = await w.outbox.peekPending(10);
    await w.outbox.park(a!.id, 'blocked', 'Task limit reached');
    const pending = await w.outbox.peekPending(10);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.status).toBe('pending');
    expect(await w.outbox.pendingCount()).toBe(1);
  });

  it('parks with the server message and counts per status', async () => {
    await w.tasks.create({ title: 'a' });
    await w.tasks.create({ title: 'b' });
    await w.tasks.create({ title: 'c' });
    const [a, b] = await w.outbox.peekPending(10);
    await w.outbox.park(a!.id, 'blocked', 'plan limit');
    await w.outbox.park(b!.id, 'rejected', 'title too long');
    expect(await w.outbox.countByStatus()).toEqual({
      pending: 1,
      blocked: 1,
      rejected: 1,
    });
    const parked = await w.outbox.listParked();
    expect(parked.map(e => [e.status, e.lastError])).toEqual([
      ['blocked', 'plan limit'],
      ['rejected', 'title too long'],
    ]);
  });

  it('records attempts without changing status', async () => {
    await w.tasks.create({ title: 'a' });
    const [e] = await w.outbox.peekPending(1);
    await w.outbox.recordAttempt(e!.id, 'HTTP 500');
    await w.outbox.recordAttempt(e!.id, 'HTTP 503');
    const [again] = await w.outbox.peekPending(1);
    expect(again).toMatchObject({
      attempts: 2,
      lastError: 'HTTP 503',
      status: 'pending',
    });
  });

  it('retryParked moves everything or just the named entries back to pending', async () => {
    for (const title of ['a', 'b', 'c']) {
      await w.tasks.create({ title });
    }
    const [a, b, c] = await w.outbox.peekPending(10);
    await w.outbox.recordAttempt(a!.id, 'x');
    await w.outbox.park(a!.id, 'rejected', 'bad');
    await w.outbox.park(b!.id, 'blocked', 'limit');
    await w.outbox.park(c!.id, 'blocked', 'limit');

    expect(await w.outbox.retryParked([a!.id])).toBe(1);
    const [revived] = await w.outbox.peekPending(10);
    expect(revived).toMatchObject({
      id: a!.id,
      attempts: 0,
      lastError: null,
      changeId: a!.changeId,
    });

    expect(await w.outbox.retryParked()).toBe(2);
    expect(await w.outbox.countByStatus()).toEqual({
      pending: 3,
      blocked: 0,
      rejected: 0,
    });
    expect(await w.outbox.retryParked()).toBe(0);
  });
});

describe('coalescing with parked entries', () => {
  it('an edit revives the parked upsert instead of queuing a second one', async () => {
    const task = await w.tasks.create({ title: 'one' });
    const id = await firstId();
    const [before] = await outboxRows(w.db);
    await w.outbox.recordAttempt(id, 'x');
    await w.outbox.park(id, 'rejected', 'title too long');

    await w.tasks.update(task.id, { title: 'two' });

    const rows = await outboxRows(w.db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id,
      status: 'pending',
      attempts: 0,
      last_error: null,
      origin: 'create',
      change_id: before!.change_id,
    });
    expect(JSON.parse(rows[0]!.payload).title).toBe('two');
  });

  it('deleting an entity whose create is parked drops everything and the row', async () => {
    const task = await w.tasks.create({ title: 'one' });
    await w.outbox.park(await firstId(), 'blocked', 'limit');
    expect(await w.tasks.delete(task.id)).toBe(true);
    expect(await outboxRows(w.db)).toEqual([]);
    expect(await rawRows(w.db, 'tasks')).toEqual([]);
  });

  it('deleting a known entity with a parked update replaces it by one pending delete', async () => {
    const task = await w.tasks.create({ title: 'one' });
    await w.outbox.markSent([await firstId()]);
    await w.tasks.update(task.id, { title: 'two' });
    await w.outbox.park(await firstId(), 'rejected', 'conflict');

    await w.tasks.delete(task.id);

    expect(await outboxSummary(w.db)).toEqual([`task:delete:${task.id}`]);
    expect((await outboxRows(w.db))[0]!.status).toBe('pending');
  });

  it('re-adding a link replaces a parked delete of the same link', async () => {
    const task = await w.tasks.create({ title: 't' });
    const tag = await w.tags.create({ name: 'g' });
    await w.tags.addToTask(task.id, tag.id);
    await w.outbox.markSent((await w.outbox.peekPending(10)).map(e => e.id));
    await w.tags.removeFromTask(task.id, tag.id);
    await w.outbox.park(await firstId(), 'rejected', 'x');

    await w.tags.addToTask(task.id, tag.id);

    expect(await outboxSummary(w.db)).toEqual([
      `task_tag:upsert:${task.id}:${tag.id}`,
    ]);
  });

  it('a pull does not overwrite a row whose change is parked', async () => {
    const task = await w.tasks.create({ title: 'mine' });
    await w.outbox.park(await firstId(), 'blocked', 'limit');
    const result = await w.remoteChanges.applyRemoteChanges({
      cursor: 5,
      tasks: [
        {
          task_id: task.id,
          title: 'theirs',
          updated_at: 9_999_999,
          deleted: false,
        },
      ],
    });
    expect(result).toMatchObject({ applied: 0, skippedPending: 1 });
    expect((await w.tasks.get(task.id))?.title).toBe('mine');
  });
});
