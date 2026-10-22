import { openTestWorld, type TestWorld } from '../helpers/testRepositories';

let w: TestWorld;
let heard: number[];
beforeEach(async () => {
  w = await openTestWorld();
  heard = [];
  w.changes.subscribe(() => {
    w.outbox.pendingCount().then(
      n => heard.push(n),
      () => undefined,
    );
  });
});
afterEach(() => w.db.close());

const settle = () => new Promise(resolve => setImmediate(resolve));

describe('change notification', () => {
  it('fires after a create has committed, so the entry is already queued', async () => {
    await w.tasks.create({ title: 'a' });
    await settle();
    expect(heard).toEqual([1]);
  });

  it('fires once per mutation, nested transactions included', async () => {
    const list = await w.taskLists.create({ name: 'L' });
    const task = await w.tasks.create({ title: 't', listId: list.id });
    heard.length = 0;
    let calls = 0;
    w.changes.subscribe(() => (calls += 1));
    await w.taskLists.delete(list.id); // detaches the task inside the same transaction
    await w.tasks.update(task.id, { title: 'x' });
    expect(calls).toBe(2);
  });

  it('does not fire for a mutation that rolls back', async () => {
    let calls = 0;
    w.changes.subscribe(() => (calls += 1));
    await expect(w.tasks.create({ title: '   ' })).rejects.toBeDefined();
    await expect(
      w.tags.addToTask('tsk_nope', 'tag_nope'),
    ).rejects.toBeDefined();
    expect(calls).toBe(0);
  });

  it('does not fire for reads or for applying a pull', async () => {
    let calls = 0;
    w.changes.subscribe(() => (calls += 1));
    await w.tasks.list();
    await w.outbox.pendingCount();
    await w.remoteChanges.applyRemoteChanges({
      cursor: 3,
      tasks: [{ task_id: 'tsk_x', title: 'x', updated_at: 5 }],
    });
    expect(calls).toBe(0);
  });

  it('stops notifying after unsubscribe', async () => {
    let calls = 0;
    const off = w.changes.subscribe(() => (calls += 1));
    off();
    await w.tasks.create({ title: 'a' });
    expect(calls).toBe(0);
  });
});
