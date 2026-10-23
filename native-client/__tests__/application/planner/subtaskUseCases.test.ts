import { translate } from '@/application/i18n';
import { NotFoundError, ValidationError } from '@/domain';
import {
  openPlannerWorld,
  type PlannerWorld,
} from '../../helpers/plannerWorld';
import { backendValidate } from '../../helpers/backendContract';
import { outboxRows } from '../../helpers/testRepositories';

let w: PlannerWorld;
beforeEach(async () => {
  w = await openPlannerWorld();
});
afterEach(() => w.db.close());

const subs = () => w.planner.subtasks;
const said = (): string | undefined => {
  const notice = w.planner.notices.getSnapshot();
  return notice
    ? translate('en', notice.message.key, notice.message.params)
    : undefined;
};
const pushAll = async () =>
  w.outbox.markSent((await w.outbox.peekPending(100)).map(e => e.id));
const titles = async (taskId: string) =>
  (await w.subtasks.listByTask(taskId)).map(s => s.title);

describe('adding a subtask', () => {
  it('trims the title, queues the full body with the parent task id and says so', async () => {
    const task = await w.tasks.create({ title: 'T' });
    await pushAll();
    const sub = await subs().add(task.id, '  buy bread  ');
    expect(sub).toMatchObject({
      taskId: task.id,
      title: 'buy bread',
      completed: false,
    });
    const [row] = await outboxRows(w.db);
    expect(row).toMatchObject({
      entity: 'subtask',
      op: 'upsert',
      entity_id: sub.id,
      origin: 'create',
    });
    expect(JSON.parse(row!.payload)).toEqual({
      task_id: task.id,
      title: 'buy bread',
      completed: false,
      sort_order: sub.sortOrder,
    });
    expect(said()).toBe('Added subtask buy bread');
  });

  it('keeps creation order, even after a toggle changes updated_at', async () => {
    const task = await w.tasks.create({ title: 'T' });
    const a = await subs().add(task.id, 'a');
    w.clock.tick(10);
    await subs().add(task.id, 'b');
    w.clock.tick(10);
    await subs().add(task.id, 'c');
    w.clock.tick(10);
    await subs().setCompleted(a.id, true);
    expect(await titles(task.id)).toEqual(['a', 'b', 'c']);
  });

  it('numbers after the highest sort order, so a deleted subtask leaves no clash', async () => {
    const task = await w.tasks.create({ title: 'T' });
    const a = await subs().add(task.id, 'a');
    const b = await subs().add(task.id, 'b');
    await subs().remove(a.id);
    const c = await subs().add(task.id, 'c');
    expect(c.sortOrder).toBeGreaterThan(b.sortOrder);
    expect(await titles(task.id)).toEqual(['b', 'c']);
  });

  it('refuses what the backend refuses and queues nothing', async () => {
    const task = await w.tasks.create({ title: 'T' });
    await pushAll();
    for (const title of ['', '   ', 'x'.repeat(201), 'é'.repeat(101)]) {
      expect({
        title: title.length,
        backend: backendValidate('subtask', {
          task_id: task.id,
          title,
        }),
        refused: await subs()
          .add(task.id, title)
          .then(
            () => false,
            e => e instanceof ValidationError,
          ),
      }).toMatchObject({ backend: expect.any(String), refused: true });
    }
    expect(await outboxRows(w.db)).toEqual([]);
  });

  it('accepts a title of exactly 200 bytes, as the backend does', async () => {
    const task = await w.tasks.create({ title: 'T' });
    const title = 'x'.repeat(200);
    expect(backendValidate('subtask', { task_id: task.id, title })).toBeNull();
    expect((await subs().add(task.id, title)).title).toBe(title);
  });

  it('refuses a task that does not exist or was deleted', async () => {
    await expect(subs().add('tsk_missing', 'x')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    const task = await w.tasks.create({ title: 'T' });
    await pushAll();
    await w.tasks.delete(task.id);
    await expect(subs().add(task.id, 'x')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('toggling, renaming and removing', () => {
  it('setCompleted queues the full body again, changing the pending upsert in place', async () => {
    const task = await w.tasks.create({ title: 'T' });
    const sub = await subs().add(task.id, 'step');
    const before = await outboxRows(w.db);
    const done = await subs().setCompleted(sub.id, true);
    expect(done.completed).toBe(true);
    const after = (await outboxRows(w.db)).filter(r => r.entity === 'subtask');
    expect(after).toHaveLength(1);
    expect(after[0]!.id).toBe(before.find(r => r.entity === 'subtask')!.id);
    expect(JSON.parse(after[0]!.payload)).toEqual({
      task_id: task.id,
      title: 'step',
      completed: true,
      sort_order: sub.sortOrder,
    });
  });

  it('toggling an already pushed subtask queues one update upsert', async () => {
    const task = await w.tasks.create({ title: 'T' });
    const sub = await subs().add(task.id, 'step');
    await pushAll();
    await subs().setCompleted(sub.id, true);
    await subs().setCompleted(sub.id, false);
    const rows = await outboxRows(w.db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ op: 'upsert', origin: 'update' });
    expect(JSON.parse(rows[0]!.payload).completed).toBe(false);
  });

  it('setCompleted to the value it already has changes nothing and queues nothing', async () => {
    const task = await w.tasks.create({ title: 'T' });
    const sub = await subs().add(task.id, 'step');
    await pushAll();
    await subs().setCompleted(sub.id, false);
    expect(await outboxRows(w.db)).toEqual([]);
  });

  it('rename trims, validates and keeps the parent', async () => {
    const task = await w.tasks.create({ title: 'T' });
    const sub = await subs().add(task.id, 'old');
    const renamed = await subs().rename(sub.id, '  new  ');
    expect(renamed).toMatchObject({ title: 'new', taskId: task.id });
    await expect(subs().rename(sub.id, '  ')).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect((await w.subtasks.get(sub.id))?.title).toBe('new');
  });

  it('removing a subtask the server knows queues a delete that names the parent task', async () => {
    const task = await w.tasks.create({ title: 'T' });
    const sub = await subs().add(task.id, 'step');
    await pushAll();
    await subs().remove(sub.id);
    const [row] = await outboxRows(w.db);
    expect(row).toMatchObject({ entity: 'subtask', op: 'delete' });
    expect(JSON.parse(row!.payload)).toEqual({ task_id: task.id });
    expect(await titles(task.id)).toEqual([]);
    expect(said()).toBe('Deleted subtask step');
  });

  it('removing a subtask the server never saw cancels it: nothing is pushed', async () => {
    const task = await w.tasks.create({ title: 'T' });
    await pushAll();
    const sub = await subs().add(task.id, 'step');
    await subs().remove(sub.id);
    expect(await outboxRows(w.db)).toEqual([]);
  });

  it('operations on a missing subtask say not found; removing it again does nothing', async () => {
    await expect(subs().setCompleted('sub_x', true)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(subs().rename('sub_x', 'a')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(subs().remove('sub_x')).resolves.toBeUndefined();
  });

  it('the subtasks of a task never leak into another task', async () => {
    const a = await w.tasks.create({ title: 'A' });
    const b = await w.tasks.create({ title: 'B' });
    await subs().add(a.id, 'for a');
    await subs().add(b.id, 'for b');
    expect(await titles(a.id)).toEqual(['for a']);
    expect(await titles(b.id)).toEqual(['for b']);
  });
});

describe('the task detail query', () => {
  const detail = (id: string) => w.planner.queries.taskDetail(id);

  it('bundles the task, its list and its subtasks in order', async () => {
    const list = await w.taskLists.create({ name: 'Home' });
    const task = await w.tasks.create({ title: 'T', listId: list.id });
    await subs().add(task.id, 'one');
    await subs().add(task.id, 'two');
    const data = (await detail(task.id))!;
    expect(data.task.id).toBe(task.id);
    expect(data.list?.name).toBe('Home');
    expect(data.subtasks.map(s => s.title)).toEqual(['one', 'two']);
  });

  it('has no list for a task without one, and is null for a missing or deleted task', async () => {
    const task = await w.tasks.create({ title: 'T' });
    expect((await detail(task.id))?.list).toBeNull();
    expect(await detail('tsk_missing')).toBeNull();
    await w.tasks.delete(task.id);
    expect(await detail(task.id)).toBeNull();
  });

  it('the live query follows timer changes and subtask changes', async () => {
    const task = await w.tasks.create({ title: 'T' });
    const live = w.planner.queries.watchTaskDetail(task.id);
    const seen: string[] = [];
    const stop = live.subscribe(() => {
      const state = live.getSnapshot();
      if (state.status === 'ready' && state.data) {
        seen.push(`${state.data.task.status}:${state.data.subtasks.length}`);
      }
    });
    await live.idle();
    await w.planner.taskTimer.start(task.id);
    await live.idle();
    await subs().add(task.id, 'x');
    await live.idle();
    stop();
    expect(seen).toEqual(['pending:0', 'in_progress:0', 'in_progress:1']);
  });
});
