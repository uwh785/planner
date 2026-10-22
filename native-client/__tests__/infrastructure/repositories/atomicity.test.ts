import {
  openTestWorld,
  outboxRows,
  rawRows,
  type TestWorld,
} from '../../helpers/testRepositories';

let w: TestWorld;
beforeEach(async () => {
  w = await openTestWorld();
});
afterEach(() => w.db.close());

const breakOutbox = () =>
  w.db.execute(
    `CREATE TRIGGER outbox_fails BEFORE INSERT ON outbox
     BEGIN SELECT RAISE(ABORT, 'outbox down'); END`,
  );

describe('row and outbox entry commit together', () => {
  it('rolls the new row back when the outbox insert fails', async () => {
    await breakOutbox();
    await expect(w.tasks.create({ title: 'a' })).rejects.toThrow(/outbox down/);
    expect(await rawRows(w.db, 'tasks')).toEqual([]);
  });

  it('rolls an update back when the outbox write fails', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await w.outbox.markSent((await w.outbox.peekPending(10)).map(e => e.id));
    await breakOutbox();
    await expect(w.tasks.update(task.id, { title: 'b' })).rejects.toThrow(
      /outbox down/,
    );
    expect((await w.tasks.get(task.id))!.title).toBe('a');
  });

  it('rolls a delete back when the tombstone entry cannot be queued', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await w.outbox.markSent((await w.outbox.peekPending(10)).map(e => e.id));
    await breakOutbox();
    await expect(w.tasks.delete(task.id)).rejects.toThrow(/outbox down/);
    expect(await w.tasks.get(task.id)).not.toBeNull();
  });

  it('rolls back a list delete and its task detaching as a unit', async () => {
    const list = await w.taskLists.create({ name: 'L' });
    const task = await w.tasks.create({ title: 'a', listId: list.id });
    await w.outbox.markSent((await w.outbox.peekPending(10)).map(e => e.id));
    await breakOutbox();
    await expect(w.taskLists.delete(list.id)).rejects.toThrow(/outbox down/);
    expect((await w.tasks.get(task.id))!.listId).toBe(list.id);
    expect(await w.taskLists.get(list.id)).not.toBeNull();
  });

  it('rolls a task_tag add back too', async () => {
    const task = await w.tasks.create({ title: 'a' });
    const tag = await w.tags.create({ name: 't' });
    await w.outbox.markSent((await w.outbox.peekPending(10)).map(e => e.id));
    await breakOutbox();
    await expect(w.tags.addToTask(task.id, tag.id)).rejects.toThrow(
      /outbox down/,
    );
    expect(await rawRows(w.db, 'task_tags')).toEqual([]);
  });

  it('leaves no partial state after a failed create', async () => {
    await breakOutbox();
    await expect(w.taskLists.create({ name: 'x' })).rejects.toBeDefined();
    expect(await outboxRows(w.db)).toEqual([]);
    expect(await rawRows(w.db, 'task_lists')).toEqual([]);
  });
});
