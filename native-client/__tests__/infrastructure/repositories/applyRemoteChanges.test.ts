import { taskTagEntityId } from '@/application/sync/entityIds';
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

const task = (id: string, extra: Record<string, unknown> = {}) => ({
  user_id: 'u1',
  task_id: id,
  list_id: null,
  title: `title ${id}`,
  description: '',
  priority: 1,
  status: 'pending',
  due_date: null,
  due_all_day: false,
  duration_ms: null,
  started_at: null,
  elapsed_ms: 0,
  completed_at: null,
  sort_order: 0,
  updated_at: 100,
  deleted: false,
  ...extra,
});

describe('applying a pull response', () => {
  it('upserts every entity kind from the exact wire shape and stores the cursor', async () => {
    const result = await w.remoteChanges.applyRemoteChanges({
      cursor: 777,
      lists: [
        {
          user_id: 'u1',
          list_id: 'lst_a',
          name: 'L',
          color: '#fff',
          icon: 'x',
          sort_order: 3,
          updated_at: 10,
          deleted: false,
        },
      ],
      tasks: [
        task('tsk_a', {
          list_id: 'lst_a',
          due_all_day: true,
          due_date: 55,
          elapsed_ms: 9,
          completed_at: 4,
          status: 'completed',
        }),
      ],
      subtasks: [
        {
          user_id: 'u1',
          task_id: 'tsk_a',
          subtask_id: 'sub_a',
          title: 's',
          completed: true,
          sort_order: 2,
          updated_at: 11,
          deleted: false,
        },
      ],
      tags: [
        {
          user_id: 'u1',
          tag_id: 'tag_a',
          name: 'g',
          color: '#000',
          updated_at: 12,
          deleted: false,
        },
      ],
      task_tags: [
        {
          user_id: 'u1',
          task_id: 'tsk_a',
          tag_id: 'tag_a',
          updated_at: 13,
          deleted: false,
        },
      ],
      classes: [
        {
          user_id: 'u1',
          class_id: 'cls_a',
          subject: 'MATH',
          day_of_week: 1,
          start_minute: 60,
          end_minute: 120,
          room: 'r',
          teacher: 't',
          color: '#abc',
          updated_at: 14,
          deleted: false,
        },
      ],
      events: [
        {
          user_id: 'u1',
          event_id: 'evt_a',
          title: 'e',
          description: 'd',
          location: 'l',
          start_at: 1000,
          end_at: null,
          all_day: true,
          color: '#abc',
          updated_at: 15,
          deleted: false,
        },
      ],
    });
    expect(result).toEqual({ applied: 7, skippedPending: 0, invalid: 0 });
    expect(await w.syncState.getCursor()).toBe(777);
    expect(await w.taskLists.get('lst_a')).toMatchObject({
      name: 'L',
      sortOrder: 3,
      updatedAt: 10,
    });
    expect(await w.tasks.get('tsk_a')).toMatchObject({
      listId: 'lst_a',
      dueAllDay: true,
      dueDate: 55,
      elapsedMs: 9,
      completedAt: 4,
      status: 'completed',
      updatedAt: 100,
    });
    expect((await w.subtasks.listByTask('tsk_a'))[0]).toMatchObject({
      id: 'sub_a',
      completed: true,
    });
    expect((await w.tags.tagsForTask('tsk_a')).map(t => t.id)).toEqual([
      'tag_a',
    ]);
    expect((await w.classSessions.list())[0]).toMatchObject({
      id: 'cls_a',
      subject: 'MATH',
      room: 'r',
    });
    expect((await w.events.list())[0]).toMatchObject({
      id: 'evt_a',
      allDay: true,
      endAt: null,
    });
    expect(await outboxRows(w.db)).toEqual([]);
  });

  it('overwrites an existing synced row with the remote version', async () => {
    await w.remoteChanges.applyRemoteChanges({
      cursor: 1,
      tasks: [task('tsk_a')],
    });
    await w.remoteChanges.applyRemoteChanges({
      cursor: 2,
      tasks: [task('tsk_a', { title: 'renamed', updated_at: 200 })],
    });
    expect(await w.tasks.get('tsk_a')).toMatchObject({
      title: 'renamed',
      updatedAt: 200,
    });
    expect(await rawRows(w.db, 'tasks')).toHaveLength(1);
  });

  it('applies tombstones, which then disappear from reads', async () => {
    await w.remoteChanges.applyRemoteChanges({
      cursor: 1,
      tasks: [task('tsk_a')],
    });
    await w.remoteChanges.applyRemoteChanges({
      cursor: 2,
      tasks: [task('tsk_a', { deleted: true, updated_at: 300 })],
    });
    expect(await w.tasks.get('tsk_a')).toBeNull();
    expect(await w.tasks.list()).toEqual([]);
    expect(await rawRows(w.db, 'tasks')).toMatchObject([
      { deleted: 1, updated_at: 300 },
    ]);
  });

  it('stores a tombstone for a row it has never seen', async () => {
    const r = await w.remoteChanges.applyRemoteChanges({
      cursor: 1,
      tags: [
        { tag_id: 'tag_x', name: 'n', color: '', updated_at: 5, deleted: true },
      ],
    });
    expect(r.applied).toBe(1);
    expect(await rawRows(w.db, 'tags')).toMatchObject([
      { tag_id: 'tag_x', deleted: 1 },
    ]);
  });

  it('accepts children before parents (no foreign keys)', async () => {
    const r = await w.remoteChanges.applyRemoteChanges({
      cursor: 1,
      subtasks: [
        {
          task_id: 'tsk_late',
          subtask_id: 'sub_1',
          title: 's',
          completed: false,
          sort_order: 0,
          updated_at: 1,
          deleted: false,
        },
      ],
      task_tags: [
        {
          task_id: 'tsk_late',
          tag_id: 'tag_late',
          updated_at: 1,
          deleted: false,
        },
      ],
      tasks: [task('tsk_late', { list_id: 'lst_late' })],
    });
    expect(r.applied).toBe(3);
    expect(await w.tasks.get('tsk_late')).toMatchObject({ listId: 'lst_late' });
  });

  it('ignores unknown fields and treats missing arrays as empty', async () => {
    const r = await w.remoteChanges.applyRemoteChanges({
      cursor: 9,
      future_thing: [1, 2],
      tasks: [task('tsk_a', { list_name: 'x', list_color: 'y', brand_new: 1 })],
    });
    expect(r).toEqual({ applied: 1, skippedPending: 0, invalid: 0 });
    expect(await w.syncState.getCursor()).toBe(9);
  });

  it('applies an empty response and still advances the cursor', async () => {
    await w.remoteChanges.applyRemoteChanges({ cursor: 42 });
    expect(await w.syncState.getCursor()).toBe(42);
  });

  it('counts malformed rows instead of failing the whole pull', async () => {
    const r = await w.remoteChanges.applyRemoteChanges({
      cursor: 3,
      tasks: [
        task('tsk_ok'),
        { title: 'no id' },
        task('tsk_bad', { status: 'weird' }),
        'junk',
        null,
      ],
      events: [
        {
          event_id: 'evt_bad',
          title: 'x',
          start_at: 10,
          end_at: 5,
          updated_at: 1,
        },
      ],
    });
    expect(r).toEqual({ applied: 1, skippedPending: 0, invalid: 5 });
    expect(await rawRows(w.db, 'tasks')).toHaveLength(1);
    expect(await w.syncState.getCursor()).toBe(3);
  });

  it('keeps the previous cursor when the response carries none', async () => {
    await w.syncState.setCursor(5);
    await w.remoteChanges.applyRemoteChanges({ tasks: [task('tsk_a')] });
    expect(await w.syncState.getCursor()).toBe(5);
  });

  it('rejects a response that is not an object', async () => {
    await expect(w.remoteChanges.applyRemoteChanges('nope')).rejects.toThrow(
      /pull response/i,
    );
    await expect(w.remoteChanges.applyRemoteChanges(null)).rejects.toThrow(
      /pull response/i,
    );
  });
});

describe('rows with a pending local change', () => {
  it('skips an entity with a pending upsert, keeping the local edit', async () => {
    const local = await w.tasks.create({ title: 'local edit' });
    const r = await w.remoteChanges.applyRemoteChanges({
      cursor: 10,
      tasks: [
        task(local.id, { title: 'remote version', updated_at: 999999999 }),
        task('tsk_other'),
      ],
    });
    expect(r).toEqual({ applied: 1, skippedPending: 1, invalid: 0 });
    expect((await w.tasks.get(local.id))!.title).toBe('local edit');
    expect(await w.tasks.get('tsk_other')).not.toBeNull();
  });

  it('skips an entity with a pending delete so a tombstone is not resurrected', async () => {
    await w.remoteChanges.applyRemoteChanges({
      cursor: 1,
      tasks: [task('tsk_a')],
    });
    await w.tasks.delete('tsk_a');
    const r = await w.remoteChanges.applyRemoteChanges({
      cursor: 2,
      tasks: [task('tsk_a', { title: 'back' })],
    });
    expect(r.skippedPending).toBe(1);
    expect(await w.tasks.get('tsk_a')).toBeNull();
  });

  it('uses the composite id for task_tag', async () => {
    await w.remoteChanges.applyRemoteChanges({
      cursor: 1,
      tasks: [task('tsk_a')],
      tags: [
        {
          tag_id: 'tag_a',
          name: 'g',
          color: '',
          updated_at: 1,
          deleted: false,
        },
      ],
      task_tags: [
        { task_id: 'tsk_a', tag_id: 'tag_a', updated_at: 1, deleted: false },
      ],
    });
    await w.tags.removeFromTask('tsk_a', 'tag_a');
    const r = await w.remoteChanges.applyRemoteChanges({
      cursor: 2,
      task_tags: [
        { task_id: 'tsk_a', tag_id: 'tag_a', updated_at: 50, deleted: false },
        { task_id: 'tsk_a', tag_id: 'tag_b', updated_at: 50, deleted: false },
      ],
    });
    expect(r).toMatchObject({ applied: 1, skippedPending: 1 });
    expect(await w.tags.tagsForTask('tsk_a')).toEqual([]);
    expect(taskTagEntityId('tsk_a', 'tag_a')).toBe('tsk_a:tag_a');
  });

  it('does not let a pending entry of one entity kind block another with the same id', async () => {
    const t = await w.tags.create({ name: 'g' });
    const r = await w.remoteChanges.applyRemoteChanges({
      cursor: 1,
      lists: [
        {
          list_id: t.id,
          name: 'same id, different entity',
          updated_at: 1,
          deleted: false,
        },
      ],
    });
    expect(r.applied).toBe(1);
  });
});

describe('atomicity of a pull', () => {
  it('rolls everything back, cursor included, when a row cannot be written', async () => {
    await w.syncState.setCursor(5);
    await w.db.execute(
      `CREATE TRIGGER no_events BEFORE INSERT ON events
       BEGIN SELECT RAISE(ABORT, 'disk full'); END`,
    );
    await expect(
      w.remoteChanges.applyRemoteChanges({
        cursor: 100,
        tasks: [task('tsk_a')],
        events: [
          {
            event_id: 'evt_a',
            title: 'e',
            start_at: 1,
            updated_at: 1,
            deleted: false,
          },
        ],
      }),
    ).rejects.toThrow(/disk full/);
    expect(await rawRows(w.db, 'tasks')).toEqual([]);
    expect(await w.syncState.getCursor()).toBe(5);
  });
});
