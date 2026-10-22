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

/** Simulates a successful push: the server now knows every pending entry. */
const pushAll = async () => {
  const pending = await w.outbox.peekPending(100);
  await w.outbox.markSent(pending.map(e => e.id));
};

describe('upsert coalescing', () => {
  it('collapses consecutive upserts of one entity into the latest payload', async () => {
    const task = await w.tasks.create({ title: 'one' });
    const [first] = await outboxRows(w.db);
    await w.tasks.update(task.id, { title: 'two' });
    await w.tasks.update(task.id, { title: 'three' });
    const rows = await outboxRows(w.db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: first!.id,
      change_id: first!.change_id,
      origin: 'create',
    });
    expect(JSON.parse(rows[0]!.payload).title).toBe('three');
  });

  it('keeps the ordering key so parents still precede children', async () => {
    const list = await w.taskLists.create({ name: 'L' });
    const task = await w.tasks.create({ title: 't', listId: list.id });
    await w.taskLists.update(list.id, { name: 'L2' });
    await w.tasks.update(task.id, { title: 't2' });
    expect(await outboxSummary(w.db)).toEqual([
      `list:upsert:${list.id}`,
      `task:upsert:${task.id}`,
    ]);
  });

  it('keeps separate entries for different entities', async () => {
    await w.tasks.create({ title: 'a' });
    await w.tasks.create({ title: 'b' });
    expect(await w.outbox.pendingCount()).toBe(2);
  });

  it('starts a new entry after the previous one was pushed, marked as an update', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await pushAll();
    expect(await w.outbox.pendingCount()).toBe(0);
    await w.tasks.update(task.id, { title: 'b' });
    const rows = await outboxRows(w.db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ op: 'upsert', origin: 'update' });
  });
});

describe('delete of an entity created offline and never pushed', () => {
  it('drops the pending create and hard-deletes the local row', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await w.tasks.update(task.id, { title: 'b' });
    expect(await w.tasks.delete(task.id)).toBe(true);
    expect(await outboxRows(w.db)).toEqual([]);
    expect(await rawRows(w.db, 'tasks')).toEqual([]);
  });

  it('applies to every entity kind', async () => {
    const list = await w.taskLists.create({ name: 'l' });
    const tag = await w.tags.create({ name: 't' });
    const ev = await w.events.create({ title: 'e', startAt: 1 });
    const cls = await w.classSessions.create({
      subject: 'c',
      dayOfWeek: 0,
      startMinute: 0,
      endMinute: 1,
    });
    const task = await w.tasks.create({ title: 'x' });
    const sub = await w.subtasks.create({ taskId: task.id, title: 's' });
    await w.subtasks.delete(sub.id);
    await w.events.delete(ev.id);
    await w.classSessions.delete(cls.id);
    await w.tags.delete(tag.id);
    await w.taskLists.delete(list.id);
    await w.tasks.delete(task.id);
    expect(await outboxRows(w.db)).toEqual([]);
    for (const table of [
      'task_lists',
      'tasks',
      'subtasks',
      'tags',
      'class_sessions',
      'events',
    ]) {
      expect(await rawRows(w.db, table)).toEqual([]);
    }
  });

  it('also drops pending children of a task the server never saw', async () => {
    const tag = await w.tags.create({ name: 't' });
    await pushAll();
    const task = await w.tasks.create({ title: 'a' });
    await w.subtasks.create({ taskId: task.id, title: 's' });
    await w.tags.addToTask(task.id, tag.id);
    await w.tasks.delete(task.id);
    expect(await outboxRows(w.db)).toEqual([]);
    expect(await rawRows(w.db, 'subtasks')).toEqual([]);
    expect(await rawRows(w.db, 'task_tags')).toEqual([]);
    expect(await rawRows(w.db, 'tags')).toHaveLength(1);
  });
});

describe('delete of an entity the server knows', () => {
  it('keeps a tombstone row and one delete entry, dropping pending upserts', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await pushAll();
    w.clock.tick();
    await w.tasks.update(task.id, { title: 'edited' });
    w.clock.tick();
    await w.tasks.delete(task.id);
    const rows = await outboxRows(w.db);
    expect(rows.map(r => `${r.op}:${r.entity_id}`)).toEqual([
      `delete:${task.id}`,
    ]);
    expect(JSON.parse(rows[0]!.payload)).toEqual({});
    const [tomb] = await rawRows<{ deleted: number; updated_at: number }>(
      w.db,
      'tasks',
    );
    expect(tomb).toMatchObject({ deleted: 1, updated_at: w.clock.current });
    expect(await w.tasks.get(task.id)).toBeNull();
  });

  it('is idempotent: deleting twice queues a single delete', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await pushAll();
    expect(await w.tasks.delete(task.id)).toBe(true);
    expect(await w.tasks.delete(task.id)).toBe(false);
    expect(await w.outbox.pendingCount()).toBe(1);
  });

  it('puts the parent task id in a subtask delete body', async () => {
    const task = await w.tasks.create({ title: 'a' });
    const sub = await w.subtasks.create({ taskId: task.id, title: 's' });
    await pushAll();
    await w.subtasks.delete(sub.id);
    const [entry] = await outboxRows(w.db);
    expect(entry).toMatchObject({
      entity: 'subtask',
      op: 'delete',
      entity_id: sub.id,
    });
    expect(JSON.parse(entry!.payload)).toEqual({ task_id: task.id });
  });

  it('treats a row that arrived by pull as known to the server', async () => {
    await w.remoteChanges.applyRemoteChanges({
      cursor: 1,
      tasks: [
        {
          task_id: 'tsk_remote',
          title: 'r',
          status: 'pending',
          priority: 0,
          updated_at: 5,
          deleted: false,
        },
      ],
    });
    await w.tasks.delete('tsk_remote');
    expect(await outboxSummary(w.db)).toEqual(['task:delete:tsk_remote']);
  });
});

describe('what a delete cascades to', () => {
  it('does not tombstone subtasks of a synced task (the server does not either)', async () => {
    const task = await w.tasks.create({ title: 'a' });
    const sub = await w.subtasks.create({ taskId: task.id, title: 's' });
    await pushAll();
    await w.tasks.delete(task.id);
    expect(await outboxSummary(w.db)).toEqual([`task:delete:${task.id}`]);
    const [row] = await rawRows<{ deleted: number }>(w.db, 'subtasks');
    expect(row!.deleted).toBe(0);
    expect(await w.subtasks.listByTask(task.id)).toHaveLength(1);
    expect(sub.id).toBeDefined();
  });

  it('tombstones the links of a synced tag locally without queuing them (the server cascades)', async () => {
    const task = await w.tasks.create({ title: 'a' });
    const tag = await w.tags.create({ name: 't' });
    await w.tags.addToTask(task.id, tag.id);
    await pushAll();
    w.clock.tick();
    await w.tags.delete(tag.id);
    expect(await outboxSummary(w.db)).toEqual([`tag:delete:${tag.id}`]);
    const [link] = await rawRows<{ deleted: number; updated_at: number }>(
      w.db,
      'task_tags',
    );
    expect(link).toMatchObject({ deleted: 1, updated_at: w.clock.current });
    expect(await w.tags.tagsForTask(task.id)).toEqual([]);
  });

  it('removes every trace of a never-pushed tag and its links', async () => {
    const task = await w.tasks.create({ title: 'a' });
    await pushAll();
    const tag = await w.tags.create({ name: 't' });
    await w.tags.addToTask(task.id, tag.id);
    await w.tags.delete(tag.id);
    expect(await outboxRows(w.db)).toEqual([]);
    expect(await rawRows(w.db, 'task_tags')).toEqual([]);
    expect(await rawRows(w.db, 'tags')).toEqual([]);
  });

  it('detaches tasks from a deleted list so they stay pushable', async () => {
    const list = await w.taskLists.create({ name: 'L' });
    const task = await w.tasks.create({ title: 'a', listId: list.id });
    await pushAll();
    await w.taskLists.delete(list.id);
    expect((await w.tasks.get(task.id))!.listId).toBeNull();
    const rows = await outboxRows(w.db);
    expect(rows.map(r => `${r.entity}:${r.op}`)).toEqual([
      'task:upsert',
      'list:delete',
    ]);
    expect(JSON.parse(rows[0]!.payload).list_id).toBeNull();
  });

  it('detaches tasks of a never-pushed list inside their pending create', async () => {
    const list = await w.taskLists.create({ name: 'L' });
    const task = await w.tasks.create({ title: 'a', listId: list.id });
    await w.taskLists.delete(list.id);
    const rows = await outboxRows(w.db);
    expect(rows.map(r => `${r.entity}:${r.op}:${r.origin}`)).toEqual([
      'task:upsert:create',
    ]);
    expect(JSON.parse(rows[0]!.payload).list_id).toBeNull();
    expect((await w.tasks.get(task.id))!.listId).toBeNull();
  });
});
