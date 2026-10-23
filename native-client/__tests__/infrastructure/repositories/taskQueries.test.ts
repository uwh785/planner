import { openTestWorld, type TestWorld } from '../../helpers/testRepositories';

let w: TestWorld;
beforeEach(async () => {
  w = await openTestWorld();
});
afterEach(() => w.db.close());

const titles = (tasks: { title: string }[]) => tasks.map(t => t.title);

describe('task list ordering and filters', () => {
  it('plan order: sort order, then due date (undated last), then creation order', async () => {
    await w.tasks.create({ title: 'undated first made' });
    await w.tasks.create({ title: 'due late', dueDate: 3_000 });
    await w.tasks.create({ title: 'due soon', dueDate: 1_000 });
    await w.tasks.create({ title: 'undated second made' });
    await w.tasks.create({ title: 'sorted first', sortOrder: -1 });
    await w.tasks.create({ title: 'same day later made', dueDate: 1_000 });
    const planned = await w.tasks.list({ order: 'plan' });
    expect(titles(planned)).toEqual([
      'sorted first',
      'due soon',
      'same day later made',
      'due late',
      'undated first made',
      'undated second made',
    ]);
  });

  it('keeps creation order when an earlier task is edited later', async () => {
    const first = await w.tasks.create({ title: 'first' });
    await w.tasks.create({ title: 'second' });
    w.clock.tick();
    await w.tasks.update(first.id, { description: 'touched' });
    expect(titles(await w.tasks.list({ order: 'plan' }))).toEqual([
      'first',
      'second',
    ]);
  });

  it('splits open from completed and orders completed by most recent', async () => {
    const a = await w.tasks.create({ title: 'a' });
    const b = await w.tasks.create({ title: 'b' });
    await w.tasks.create({ title: 'c' });
    const d = await w.tasks.create({ title: 'd', status: 'in_progress' });
    await w.tasks.complete(a.id, 100);
    await w.tasks.complete(b.id, 200);
    expect(
      titles(await w.tasks.list({ completion: 'open', order: 'plan' })),
    ).toEqual(['c', 'd']);
    expect(
      titles(
        await w.tasks.list({
          completion: 'completed',
          order: 'recentlyCompleted',
        }),
      ),
    ).toEqual(['b', 'a']);
    expect(d.status).toBe('in_progress');
  });

  it('limits and counts', async () => {
    for (let i = 0; i < 5; i += 1) {
      await w.tasks.create({ title: `t${i}` });
    }
    expect(await w.tasks.list({ limit: 2, order: 'plan' })).toHaveLength(2);
    expect(await w.tasks.count()).toBe(5);
    const [one] = await w.tasks.list({ limit: 1 });
    await w.tasks.complete(one!.id, 9);
    expect(await w.tasks.count({ completion: 'open' })).toBe(4);
    expect(await w.tasks.count({ completion: 'completed' })).toBe(1);
  });

  it('counts per list, hiding tombstones and completed tasks', async () => {
    const a = await w.taskLists.create({ name: 'A' });
    const b = await w.taskLists.create({ name: 'B' });
    await w.tasks.create({ title: '1', listId: a.id });
    await w.tasks.create({ title: '2', listId: a.id });
    const done = await w.tasks.create({ title: '3', listId: a.id });
    const gone = await w.tasks.create({ title: '4', listId: b.id });
    await w.tasks.create({ title: '5' });
    await w.tasks.complete(done.id, 1);
    await w.tasks.delete(gone.id);
    const counts = await w.tasks.countOpenByList();
    expect(counts.get(a.id)).toBe(2);
    expect(counts.get(b.id)).toBeUndefined();
    expect(counts.get(null)).toBe(1);
  });

  it('keeps the filter by list working with the new options', async () => {
    const a = await w.taskLists.create({ name: 'A' });
    await w.tasks.create({ title: 'in a', listId: a.id });
    await w.tasks.create({ title: 'loose' });
    expect(
      titles(
        await w.tasks.list({ listId: a.id, completion: 'open', order: 'plan' }),
      ),
    ).toEqual(['in a']);
    expect(titles(await w.tasks.list({ listId: null, order: 'plan' }))).toEqual(
      ['loose'],
    );
  });
});

describe('overdue filter', () => {
  const at = 1_000_000_000_000;
  const DAY = 86_400_000;

  it('applies the web rule: timed once past, all-day once the day has ended, never completed', async () => {
    await w.tasks.create({
      title: 'timed past',
      dueDate: at - 1,
      dueAllDay: false,
    });
    await w.tasks.create({ title: 'timed now', dueDate: at, dueAllDay: false });
    await w.tasks.create({
      title: 'all day open',
      dueDate: at - DAY + 1,
      dueAllDay: true,
    });
    await w.tasks.create({
      title: 'all day ended',
      dueDate: at - DAY,
      dueAllDay: true,
    });
    await w.tasks.create({ title: 'no date' });
    const done = await w.tasks.create({
      title: 'done',
      dueDate: 1,
      dueAllDay: false,
    });
    await w.tasks.complete(done.id, 2);
    const overdue = await w.tasks.list({ overdueAt: at, order: 'plan' });
    expect(titles(overdue)).toEqual(['all day ended', 'timed past']);
    expect(await w.tasks.count({ overdueAt: at })).toBe(2);
  });

  it('combines with a list and ignores deleted tasks', async () => {
    const list = await w.taskLists.create({ name: 'L' });
    await w.tasks.create({
      title: 'in list',
      listId: list.id,
      dueDate: 1,
      dueAllDay: false,
    });
    const gone = await w.tasks.create({
      title: 'gone',
      dueDate: 1,
      dueAllDay: false,
    });
    await w.tasks.create({ title: 'other list', dueDate: 1, dueAllDay: false });
    await w.tasks.delete(gone.id);
    expect(
      titles(await w.tasks.list({ overdueAt: at, listId: list.id })),
    ).toEqual(['in list']);
    expect(await w.tasks.count({ overdueAt: at })).toBe(2);
  });
});
