import { openTestWorld, type TestWorld } from '../../helpers/testRepositories';

let w: TestWorld;
beforeEach(async () => {
  w = await openTestWorld();
});
afterEach(() => w.db.close());

const titles = (tasks: { title: string }[]) => tasks.map(t => t.title);

describe('due date range filter', () => {
  it('keeps tasks due in [dueFrom, dueTo), open and completed alike', async () => {
    await w.tasks.create({ title: 'before', dueDate: 99 });
    await w.tasks.create({ title: 'at start', dueDate: 100 });
    const done = await w.tasks.create({ title: 'done inside', dueDate: 150 });
    await w.tasks.create({ title: 'at end', dueDate: 200 });
    await w.tasks.create({ title: 'undated' });
    await w.tasks.complete(done.id, 1);
    const range = { dueFrom: 100, dueTo: 200 };
    expect(titles(await w.tasks.list({ ...range, order: 'plan' }))).toEqual([
      'at start',
      'done inside',
    ]);
    expect(await w.tasks.count(range)).toBe(2);
  });

  it('works with only one bound and with other filters', async () => {
    await w.tasks.create({ title: 'a', dueDate: 100 });
    await w.tasks.create({ title: 'b', dueDate: 300 });
    expect(titles(await w.tasks.list({ dueFrom: 200 }))).toEqual(['b']);
    expect(titles(await w.tasks.list({ dueTo: 200 }))).toEqual(['a']);
    expect(
      await w.tasks.count({ dueFrom: 0, dueTo: 1000, completion: 'completed' }),
    ).toBe(0);
  });

  it('ignores deleted tasks', async () => {
    const gone = await w.tasks.create({ title: 'gone', dueDate: 150 });
    await w.tasks.delete(gone.id);
    expect(await w.tasks.count({ dueFrom: 100, dueTo: 200 })).toBe(0);
  });
});
