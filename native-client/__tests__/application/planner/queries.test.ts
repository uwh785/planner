import { ChangeFeed } from '@/application/sync/ChangeFeed';
import { LiveQuery } from '@/application/planner/LiveQuery';
import {
  flushAsync,
  openPlannerWorld,
  type PlannerWorld,
} from '../../helpers/plannerWorld';

let w: PlannerWorld;
beforeEach(async () => {
  w = await openPlannerWorld();
});
afterEach(() => w.db.close());

describe('lists overview', () => {
  it('counts open tasks per list, in list order', async () => {
    const home = await w.taskLists.create({ name: 'Home' });
    const work = await w.taskLists.create({ name: 'Work' });
    await w.tasks.create({ title: '1', listId: home.id });
    await w.tasks.create({ title: '2', listId: home.id });
    const done = await w.tasks.create({ title: '3', listId: home.id });
    await w.tasks.create({ title: '4' });
    await w.tasks.complete(done.id, 1);
    const overview = await w.planner.queries.overview();
    expect(overview.lists.map(l => [l.list.name, l.openCount])).toEqual([
      ['Home', 2],
      ['Work', 0],
    ]);
    expect(overview.lists[1]!.list.id).toBe(work.id);
  });
});

describe('tasks by scope', () => {
  it('splits a list into open and completed with totals', async () => {
    const list = await w.taskLists.create({ name: 'L' });
    const a = await w.tasks.create({ title: 'a', listId: list.id });
    await w.tasks.create({ title: 'b', listId: list.id, dueDate: 5 });
    await w.tasks.create({ title: 'other' });
    await w.tasks.complete(a.id, 10);
    const sections = await w.planner.queries.tasks({ listId: list.id });
    expect(sections.open.map(t => t.title)).toEqual(['b']);
    expect(sections.completed.map(t => t.title)).toEqual(['a']);
    expect(sections.openTotal).toBe(1);
    expect(sections.completedTotal).toBe(1);
  });

  it('"All tasks" spans every list and tasks without one', async () => {
    const list = await w.taskLists.create({ name: 'L' });
    await w.tasks.create({ title: 'in', listId: list.id });
    await w.tasks.create({ title: 'out' });
    const sections = await w.planner.queries.tasks({ listId: undefined });
    expect(sections.open.map(t => t.title).sort()).toEqual(['in', 'out']);
  });

  it('orders open tasks by sort order, then due date, then creation', async () => {
    await w.tasks.create({ title: 'late', dueDate: 9 });
    await w.tasks.create({ title: 'undated' });
    await w.tasks.create({ title: 'early', dueDate: 1 });
    const { open } = await w.planner.queries.tasks({ listId: undefined });
    expect(open.map(t => t.title)).toEqual(['early', 'late', 'undated']);
  });

  it('limits what it loads but reports the real totals', async () => {
    for (let i = 0; i < 6; i += 1) {
      const t = await w.tasks.create({ title: `t${i}` });
      await w.tasks.complete(t.id, i + 1);
    }
    const sections = await w.planner.queries.tasks(
      { listId: undefined },
      { completedLimit: 2, openLimit: 1 },
    );
    expect(sections.completed).toHaveLength(2);
    expect(sections.completedTotal).toBe(6);
    expect(sections.completed.map(t => t.title)).toEqual(['t5', 't4']);
  });
});

describe('single items', () => {
  it('reads a list and a task for the edit screens', async () => {
    const list = await w.taskLists.create({ name: 'L' });
    const task = await w.tasks.create({ title: 'a', listId: list.id });
    expect((await w.planner.queries.list(list.id))?.name).toBe('L');
    const edit = await w.planner.queries.taskEdit(task.id);
    expect(edit?.task.id).toBe(task.id);
    expect(edit?.lists.map(l => l.id)).toEqual([list.id]);
    expect(await w.planner.queries.taskEdit('tsk_nope')).toBeNull();
    expect(await w.planner.queries.list('lst_nope')).toBeNull();
  });
});

describe('LiveQuery', () => {
  it('loads on first subscribe and reruns on every data change', async () => {
    const live = w.planner.queries.watchOverview();
    expect(live.getSnapshot()).toEqual({ status: 'loading' });
    const seen = jest.fn();
    const off = live.subscribe(seen);
    await flushAsync();
    expect(live.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { lists: [] },
    });
    await w.tasks.create({ title: 'x' });
    await flushAsync();
    expect(live.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { lists: [] },
    });
    await w.taskLists.create({ name: 'L' });
    await flushAsync();
    expect(live.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { lists: [{ list: { name: 'L' } }] },
    });
    expect(seen).toHaveBeenCalled();
    off();
  });

  it('follows pulled changes through the data feed', async () => {
    const live = w.planner.queries.watchTasks({ listId: undefined });
    live.subscribe(() => undefined);
    await flushAsync();
    await w.remoteChanges.applyRemoteChanges({
      cursor: 1,
      tasks: [
        {
          task_id: 'tsk_remote',
          list_id: null,
          title: 'from server',
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
          updated_at: 5,
          deleted: false,
        },
      ],
    });
    await flushAsync();
    const snap = live.getSnapshot();
    expect(snap.status === 'ready' && snap.data.open.map(t => t.title)).toEqual(
      ['from server'],
    );
  });

  it('stops listening when the last subscriber leaves', () => {
    const feed = new ChangeFeed();
    const live = new LiveQuery(async () => 1, feed);
    const off1 = live.subscribe(() => undefined);
    const off2 = live.subscribe(() => undefined);
    expect(feed.listenerCount).toBe(1);
    off1();
    expect(feed.listenerCount).toBe(1);
    off2();
    expect(feed.listenerCount).toBe(0);
  });

  it('runs one fetch at a time and ends on the newest data', async () => {
    const feed = new ChangeFeed();
    const resolvers: ((n: number) => void)[] = [];
    const live = new LiveQuery(
      () => new Promise<number>(resolve => resolvers.push(resolve)),
      feed,
    );
    live.subscribe(() => undefined);
    feed.notifyChange(); // asks for a rerun once the first fetch is done
    resolvers[0]!(1);
    await flushAsync();
    resolvers[1]!(2);
    await flushAsync();
    expect(live.getSnapshot()).toEqual({ status: 'ready', data: 2 });
  });

  it('coalesces a burst of changes into one follow-up run', async () => {
    const feed = new ChangeFeed();
    let runs = 0;
    const live = new LiveQuery(async () => {
      runs += 1;
      return runs;
    }, feed);
    live.subscribe(() => undefined);
    feed.notifyChange();
    feed.notifyChange();
    feed.notifyChange();
    await flushAsync();
    expect(runs).toBeLessThanOrEqual(3);
    expect(live.getSnapshot()).toMatchObject({ status: 'ready', data: runs });
  });

  it('keeps the last data and reports an error when a rerun fails', async () => {
    const feed = new ChangeFeed();
    let fail = false;
    const live = new LiveQuery(async () => {
      if (fail) {
        throw new Error('db closed');
      }
      return 7;
    }, feed);
    live.subscribe(() => undefined);
    await flushAsync();
    fail = true;
    feed.notifyChange();
    await flushAsync();
    expect(live.getSnapshot()).toEqual({ status: 'error', data: 7 });
  });

  it('idle() resolves once nothing is in flight', async () => {
    const feed = new ChangeFeed();
    const live = new LiveQuery(async () => 1, feed);
    live.subscribe(() => undefined);
    feed.notifyChange();
    await live.idle();
    expect(live.getSnapshot()).toEqual({ status: 'ready', data: 1 });
  });
});

describe('tasks by status filter', () => {
  async function seed() {
    const list = await w.taskLists.create({ name: 'L' });
    const pending = await w.tasks.create({ title: 'pending', listId: list.id });
    await w.tasks.create({ title: 'running', status: 'in_progress' });
    const done = await w.tasks.create({ title: 'done', listId: list.id });
    await w.tasks.complete(done.id, 5);
    await w.tasks.create({
      title: 'late',
      dueDate: w.clock.now() - 1000,
      dueAllDay: false,
    });
    return { list, pending };
  }

  it.each([
    ['all', ['late', 'pending', 'running'], ['done']],
    ['pending', ['late', 'pending'], []],
    ['in_progress', ['running'], []],
    ['completed', [], ['done']],
    ['overdue', ['late'], []],
  ] as const)('%s', async (status, open, completed) => {
    await seed();
    const sections = await w.planner.queries.tasks({ status });
    expect(sections.open.map(t => t.title).sort()).toEqual([...open]);
    expect(sections.completed.map(t => t.title)).toEqual([...completed]);
    expect(sections.openTotal).toBe(open.length);
    expect(sections.completedTotal).toBe(completed.length);
  });

  it('combines the status with one list', async () => {
    const { list } = await seed();
    const sections = await w.planner.queries.tasks({
      status: 'pending',
      listId: list.id,
    });
    expect(sections.open.map(t => t.title)).toEqual(['pending']);
  });

  it('treats an omitted status as all', async () => {
    await seed();
    const sections = await w.planner.queries.tasks({});
    expect(sections.openTotal).toBe(3);
    expect(sections.completedTotal).toBe(1);
  });
});

describe('dashboard', () => {
  it('counts by status and overdue with the web rules, and lists in-progress tasks', async () => {
    w.clock.current = new Date(2026, 9, 22, 10, 0).getTime();
    const now = w.clock.now();
    await w.tasks.create({ title: 'pending' });
    await w.tasks.create({
      title: 'running a',
      status: 'in_progress',
      dueDate: 5,
    });
    await w.tasks.create({ title: 'running b', status: 'in_progress' });
    const done = await w.tasks.create({ title: 'done', dueDate: 1 });
    await w.tasks.complete(done.id, 9);
    // Timed and past: overdue. All-day today: not yet. All-day yesterday: overdue.
    await w.tasks.create({
      title: 'timed late',
      dueDate: now - 1,
      dueAllDay: false,
    });
    await w.tasks.create({
      title: 'timed soon',
      dueDate: now + 60_000,
      dueAllDay: false,
    });
    const startOfToday = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
    await w.tasks.create({
      title: 'all day today',
      dueDate: startOfToday,
      dueAllDay: true,
    });
    await w.tasks.create({
      title: 'all day yesterday',
      dueDate: startOfToday - 86_400_000,
      dueAllDay: true,
    });
    const data = await w.planner.queries.dashboard();
    expect(data.counts).toEqual({
      pending: 5,
      inProgress: 2,
      completed: 1,
      overdue: 3,
    });
    expect(data.active.map(t => t.title)).toEqual(['running a', 'running b']);
  });

  it('shows at most ten active tasks but counts them all', async () => {
    for (let i = 0; i < 12; i += 1) {
      await w.tasks.create({ title: `r${i}`, status: 'in_progress' });
    }
    const data = await w.planner.queries.dashboard();
    expect(data.counts.inProgress).toBe(12);
    expect(data.active).toHaveLength(10);
  });

  it('is empty for a new user and follows data changes', async () => {
    const live = w.planner.queries.watchDashboard();
    live.subscribe(() => undefined);
    await flushAsync();
    expect(live.getSnapshot()).toMatchObject({
      status: 'ready',
      data: {
        counts: { pending: 0, inProgress: 0, completed: 0, overdue: 0 },
        active: [],
      },
    });
    await w.tasks.create({ title: 'x' });
    await flushAsync();
    expect(live.getSnapshot()).toMatchObject({
      data: { counts: { pending: 1 } },
    });
  });
});
