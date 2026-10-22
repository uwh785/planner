import {
  ID_SHAPE,
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

const payloadOf = async (index = 0) =>
  JSON.parse((await outboxRows(w.db))[index]!.payload);

describe('task lists', () => {
  it('creates a row and an upsert outbox entry in one step', async () => {
    const list = await w.taskLists.create({ name: ' Home ' });
    expect(list).toEqual({
      id: 'lst_0000000000000001',
      name: 'Home',
      color: '#0A84FF',
      icon: 'list',
      sortOrder: 0,
      updatedAt: w.clock.current,
      deleted: false,
    });
    expect(await w.taskLists.get(list.id)).toEqual(list);
    const [entry] = await outboxRows(w.db);
    expect(entry).toMatchObject({
      entity: 'list',
      op: 'upsert',
      entity_id: list.id,
      origin: 'create',
      status: 'pending',
      change_id: 'chg_1',
    });
    expect(JSON.parse(entry!.payload)).toEqual({
      name: 'Home',
      color: '#0A84FF',
      icon: 'list',
      sort_order: 0,
    });
  });

  it('updates a patch and enqueues the full body, not a diff', async () => {
    const list = await w.taskLists.create({ name: 'Home', color: '#111111' });
    w.clock.tick();
    const updated = await w.taskLists.update(list.id, { name: 'House' });
    expect(updated).toMatchObject({
      name: 'House',
      color: '#111111',
      updatedAt: w.clock.current,
    });
    expect(await payloadOf()).toEqual({
      name: 'House',
      color: '#111111',
      icon: 'list',
      sort_order: 0,
    });
  });

  it('returns null when updating a missing or deleted list', async () => {
    expect(await w.taskLists.update('lst_nope', { name: 'x' })).toBeNull();
  });

  it('rejects an empty name', async () => {
    await expect(w.taskLists.create({ name: '   ' })).rejects.toThrow(
      /name is required/,
    );
    expect(await outboxRows(w.db)).toEqual([]);
    expect(await rawRows(w.db, 'task_lists')).toEqual([]);
  });

  it('lists by sort order then update time, hiding tombstones', async () => {
    const a = await w.taskLists.create({ name: 'a', sortOrder: 2 });
    w.clock.tick();
    const b = await w.taskLists.create({ name: 'b', sortOrder: 1 });
    w.clock.tick();
    const c = await w.taskLists.create({ name: 'c', sortOrder: 1 });
    w.clock.tick();
    const gone = await w.taskLists.create({ name: 'gone' });
    // Pretend the server already knows "gone" so delete keeps a tombstone.
    await w.db.execute("UPDATE outbox SET origin = 'update'");
    await w.taskLists.delete(gone.id);
    expect((await w.taskLists.list()).map(l => l.id)).toEqual([
      b.id,
      c.id,
      a.id,
    ]);
    expect(await w.taskLists.get(gone.id)).toBeNull();
  });
});

describe('tasks', () => {
  it('creates with backend defaults and a snake_case body', async () => {
    const list = await w.taskLists.create({ name: 'L' });
    const task = await w.tasks.create({
      title: ' Write ',
      listId: list.id,
      priority: 2,
      dueDate: 5000,
      dueAllDay: true,
    });
    expect(task).toMatchObject({
      id: 'tsk_0000000000000002',
      listId: list.id,
      title: 'Write',
      description: '',
      priority: 2,
      status: 'pending',
      dueDate: 5000,
      dueAllDay: true,
      durationMs: null,
      startedAt: null,
      elapsedMs: 0,
      completedAt: null,
      sortOrder: 0,
      deleted: false,
    });
    expect(await payloadOf(1)).toEqual({
      list_id: list.id,
      title: 'Write',
      description: '',
      priority: 2,
      status: 'pending',
      due_date: 5000,
      due_all_day: true,
      duration_ms: null,
      started_at: null,
      sort_order: 0,
    });
  });

  it('sends a null list_id for a task without a list', async () => {
    await w.tasks.create({ title: 'Loose' });
    expect((await payloadOf()).list_id).toBeNull();
  });

  it('updates editable fields only and re-sends the whole body', async () => {
    const task = await w.tasks.create({ title: 'a', description: 'd' });
    w.clock.tick();
    const next = await w.tasks.update(task.id, { priority: 3, dueDate: 9 });
    expect(next).toMatchObject({
      title: 'a',
      description: 'd',
      priority: 3,
      dueDate: 9,
      updatedAt: w.clock.current,
    });
    expect((await payloadOf()).title).toBe('a');
    expect((await payloadOf()).priority).toBe(3);
  });

  it('can clear nullable fields with an explicit null', async () => {
    const list = await w.taskLists.create({ name: 'L' });
    const task = await w.tasks.create({
      title: 't',
      listId: list.id,
      dueDate: 7,
    });
    const next = await w.tasks.update(task.id, { listId: null, dueDate: null });
    expect(next).toMatchObject({ listId: null, dueDate: null });
  });

  it('validates like the backend (title required and capped)', async () => {
    await expect(w.tasks.create({ title: ' ' })).rejects.toThrow(
      /title is required/,
    );
    await expect(w.tasks.create({ title: 'x'.repeat(201) })).rejects.toThrow(
      /200/,
    );
    await expect(
      w.tasks.create({ title: 'ok', description: 'x'.repeat(5001) }),
    ).rejects.toThrow(/5000/);
    const t = await w.tasks.create({ title: 'ok' });
    await expect(w.tasks.update(t.id, { title: '' })).rejects.toThrow(
      /title is required/,
    );
    expect((await w.tasks.get(t.id))!.title).toBe('ok');
  });

  it('filters by list, by status and hides tombstones', async () => {
    const l1 = await w.taskLists.create({ name: '1' });
    const t1 = await w.tasks.create({ title: 'a', listId: l1.id });
    const t2 = await w.tasks.create({
      title: 'b',
      listId: l1.id,
      status: 'completed',
    });
    const t3 = await w.tasks.create({ title: 'c' });
    expect((await w.tasks.list()).map(t => t.id)).toEqual([
      t1.id,
      t2.id,
      t3.id,
    ]);
    expect((await w.tasks.list({ listId: l1.id })).map(t => t.id)).toEqual([
      t1.id,
      t2.id,
    ]);
    expect((await w.tasks.list({ listId: null })).map(t => t.id)).toEqual([
      t3.id,
    ]);
    expect(
      (await w.tasks.list({ status: 'completed' })).map(t => t.id),
    ).toEqual([t2.id]);
    expect(
      (await w.tasks.list({ listId: l1.id, status: 'pending' })).map(t => t.id),
    ).toEqual([t1.id]);
  });

  it('orders by sort order, then update time', async () => {
    const late = await w.tasks.create({ title: 'late', sortOrder: 5 });
    w.clock.tick();
    const first = await w.tasks.create({ title: 'first', sortOrder: 1 });
    w.clock.tick();
    const second = await w.tasks.create({ title: 'second', sortOrder: 1 });
    expect((await w.tasks.list()).map(t => t.id)).toEqual([
      first.id,
      second.id,
      late.id,
    ]);
  });
});

describe('subtasks', () => {
  it('creates under a task with the parent id in the body', async () => {
    const task = await w.tasks.create({ title: 't' });
    const sub = await w.subtasks.create({ taskId: task.id, title: ' step ' });
    expect(sub).toMatchObject({
      taskId: task.id,
      title: 'step',
      completed: false,
      sortOrder: 0,
    });
    expect(await payloadOf(1)).toEqual({
      task_id: task.id,
      title: 'step',
      completed: false,
      sort_order: 0,
    });
    expect(await w.subtasks.listByTask(task.id)).toEqual([sub]);
  });

  it('toggles completion and orders by sort order', async () => {
    const task = await w.tasks.create({ title: 't' });
    const b = await w.subtasks.create({
      taskId: task.id,
      title: 'b',
      sortOrder: 2,
    });
    const a = await w.subtasks.create({
      taskId: task.id,
      title: 'a',
      sortOrder: 1,
    });
    await w.subtasks.update(a.id, { completed: true });
    const rows = await w.subtasks.listByTask(task.id);
    expect(rows.map(s => s.id)).toEqual([a.id, b.id]);
    expect(rows[0]!.completed).toBe(true);
  });

  it('refuses a subtask for a task that does not exist locally', async () => {
    await expect(
      w.subtasks.create({ taskId: 'tsk_missing', title: 'x' }),
    ).rejects.toThrow(/task not found/i);
    expect(await outboxRows(w.db)).toEqual([]);
  });
});

describe('tags', () => {
  it('creates with the default color and a name/color body', async () => {
    const tag = await w.tags.create({ name: ' urgent ' });
    expect(tag).toMatchObject({ name: 'urgent', color: '#8E8E93' });
    expect(await payloadOf()).toEqual({ name: 'urgent', color: '#8E8E93' });
  });

  it('caps the name at 50 characters', async () => {
    await expect(w.tags.create({ name: 'x'.repeat(51) })).rejects.toThrow(/50/);
  });

  it('lists tags by name for the UI', async () => {
    await w.tags.create({ name: 'b' });
    await w.tags.create({ name: 'a' });
    expect((await w.tags.list()).map(t => t.name)).toEqual(['a', 'b']);
  });
});

describe('class sessions', () => {
  it('upper-cases the subject like the backend and sends the full body', async () => {
    const cls = await w.classSessions.create({
      subject: ' math ',
      dayOfWeek: 2,
      startMinute: 540,
      endMinute: 600,
    });
    expect(cls).toMatchObject({
      subject: 'MATH',
      room: '',
      teacher: '',
      color: '#0A84FF',
    });
    expect(await payloadOf()).toEqual({
      subject: 'MATH',
      day_of_week: 2,
      start_minute: 540,
      end_minute: 600,
      room: '',
      teacher: '',
      color: '#0A84FF',
    });
  });

  it('validates day and minute ranges', async () => {
    const base = { subject: 'x', dayOfWeek: 1, startMinute: 10, endMinute: 20 };
    await expect(
      w.classSessions.create({ ...base, dayOfWeek: 7 }),
    ).rejects.toThrow(/day_of_week/);
    await expect(
      w.classSessions.create({ ...base, startMinute: 20 }),
    ).rejects.toThrow(/start_minute/);
    await expect(
      w.classSessions.create({ ...base, endMinute: 1441 }),
    ).rejects.toThrow(/end_minute/);
  });

  it('lists by weekday and start time', async () => {
    const b = await w.classSessions.create({
      subject: 'b',
      dayOfWeek: 1,
      startMinute: 600,
      endMinute: 660,
    });
    const a = await w.classSessions.create({
      subject: 'a',
      dayOfWeek: 1,
      startMinute: 60,
      endMinute: 120,
    });
    const c = await w.classSessions.create({
      subject: 'c',
      dayOfWeek: 0,
      startMinute: 900,
      endMinute: 960,
    });
    expect((await w.classSessions.list()).map(x => x.id)).toEqual([
      c.id,
      a.id,
      b.id,
    ]);
  });
});

describe('events', () => {
  it('creates with defaults and requires a positive start', async () => {
    const e = await w.events.create({ title: 'Exam', startAt: 5000 });
    expect(e).toMatchObject({
      endAt: null,
      allDay: false,
      location: '',
      description: '',
    });
    expect(await payloadOf()).toEqual({
      title: 'Exam',
      description: '',
      location: '',
      start_at: 5000,
      end_at: null,
      all_day: false,
      color: '#0A84FF',
    });
    await expect(w.events.create({ title: 'x', startAt: 0 })).rejects.toThrow(
      /start_at/,
    );
    await expect(
      w.events.create({ title: 'x', startAt: 10, endAt: 5 }),
    ).rejects.toThrow(/end_at/);
  });

  it('lists by start time', async () => {
    const late = await w.events.create({ title: 'l', startAt: 9000 });
    const early = await w.events.create({ title: 'e', startAt: 1000 });
    expect((await w.events.list()).map(x => x.id)).toEqual([early.id, late.id]);
  });
});

describe('ids', () => {
  it('uses the backend prefixes and the 16-hex shape', async () => {
    const ids = [
      (await w.taskLists.create({ name: 'a' })).id,
      (await w.tasks.create({ title: 'a' })).id,
      (await w.tags.create({ name: 'a' })).id,
      (await w.events.create({ title: 'a', startAt: 1 })).id,
      (
        await w.classSessions.create({
          subject: 'a',
          dayOfWeek: 0,
          startMinute: 0,
          endMinute: 1,
        })
      ).id,
    ];
    ids.forEach(id => expect(id).toMatch(ID_SHAPE));
    expect(ids.map(i => i.split('_')[0])).toEqual([
      'lst',
      'tsk',
      'tag',
      'evt',
      'cls',
    ]);
    expect(await outboxSummary(w.db)).toHaveLength(5);
  });
});
