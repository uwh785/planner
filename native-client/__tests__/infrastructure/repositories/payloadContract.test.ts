import {
  ACCEPTED_FIELDS,
  backendValidate,
  DELETE_FIELDS,
  ENTITIES,
  PUSH_OPS,
  TIMER_FIELDS,
  TIMER_OPS,
  TRANSITION_FROM,
} from '../../helpers/backendContract';
import {
  openTestWorld,
  outboxRows,
  type TestWorld,
} from '../../helpers/testRepositories';

let w: TestWorld;
beforeEach(async () => {
  w = await openTestWorld();
});
afterEach(() => w.db.close());

/** Creates and then edits one row of every entity, leaving the outbox full. */
async function buildEverything() {
  const list = await w.taskLists.create({ name: 'L' });
  const task = await w.tasks.create({
    title: 'T',
    listId: list.id,
    dueDate: 10,
    durationMs: 60000,
  });
  const tag = await w.tags.create({ name: 'G' });
  await w.subtasks.create({ taskId: task.id, title: 'S' });
  await w.tags.addToTask(task.id, tag.id);
  await w.classSessions.create({
    subject: 'm',
    dayOfWeek: 1,
    startMinute: 10,
    endMinute: 20,
  });
  await w.events.create({ title: 'E', startAt: 5, endAt: 9 });
  await w.taskLists.update(list.id, { name: 'L2' });
  await w.tasks.update(task.id, { title: 'T2', priority: 3 });
  await w.tasks.start(task.id, 1_699_999_990_000);
  await w.tasks.pause(task.id, 1_699_999_995_000);
  await w.tasks.start(task.id, 1_699_999_996_000);
  await w.tasks.complete(task.id, 1_700_000_000_000);
  return { list, task, tag };
}

it('every upsert body uses only fields the backend decodes, with the right JSON types', async () => {
  await buildEverything();
  const rows = await outboxRows(w.db);
  expect(new Set(rows.map(r => r.entity))).toEqual(new Set(ENTITIES));
  for (const row of rows.filter(r => r.op === 'upsert')) {
    const body = JSON.parse(row.payload) as Record<string, unknown>;
    const spec = ACCEPTED_FIELDS[row.entity]!;
    expect(Object.keys(body).sort()).toEqual(Object.keys(spec).sort());
    for (const [key, check] of Object.entries(spec)) {
      expect({ entity: row.entity, key, ok: check(body[key]) }).toEqual({
        entity: row.entity,
        key,
        ok: true,
      });
    }
    expect(PUSH_OPS).toContain(row.op);
  }
});

it('every timer transition is the op the backend replays: task only, data {at}, a change id', async () => {
  const { task } = await buildEverything();
  const timers = (await outboxRows(w.db)).filter(r => r.op !== 'upsert');
  expect(timers.map(r => r.op)).toEqual([
    'start',
    'pause',
    'start',
    'complete',
  ]);
  for (const timer of timers) {
    expect(PUSH_OPS).toContain(timer.op);
    expect(TIMER_OPS[timer.op]).toContain(timer.entity);
    expect(timer.entity_id).toBe(task.id);
    const body = JSON.parse(timer.payload) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(Object.keys(TIMER_FIELDS));
    expect(TIMER_FIELDS.at!(body.at)).toBe(true);
    expect(timer.change_id).toMatch(/^[\x21-\x7e]{1,64}$/);
  }
});

it('the transitions the repository accepts are exactly the ones the backend accepts', async () => {
  const states = ['pending', 'in_progress', 'completed'] as const;
  const arrive = async (id: string, status: (typeof states)[number]) => {
    if (status !== 'pending') {
      await w.tasks.start(id, 1_000);
    }
    if (status === 'completed') {
      await w.tasks.complete(id, 2_000);
    }
  };
  for (const op of ['start', 'pause', 'complete'] as const) {
    for (const from of states) {
      const task = await w.tasks.create({ title: `${op}-${from}` });
      await arrive(task.id, from);
      const accepted = await w.tasks[op](task.id, 3_000).then(
        () => true,
        () => false,
      );
      expect({ op, from, accepted }).toEqual({
        op,
        from,
        accepted: TRANSITION_FROM[op]!.includes(from),
      });
    }
  }
});

it('a task started or completed here is described as pending with no start in its upsert body', async () => {
  const { task } = await buildEverything();
  const upsert = (await outboxRows(w.db)).find(
    r => r.entity === 'task' && r.op === 'upsert' && r.entity_id === task.id,
  )!;
  expect(JSON.parse(upsert.payload)).toMatchObject({
    status: 'pending',
    started_at: null,
  });
});

it('every upsert body passes the backend validation', async () => {
  await buildEverything();
  for (const row of (await outboxRows(w.db)).filter(r => r.op === 'upsert')) {
    expect({
      entity: row.entity,
      error: backendValidate(row.entity, JSON.parse(row.payload)),
    }).toEqual({
      entity: row.entity,
      error: null,
    });
  }
});

it('never puts server-managed or local-only keys in a body', async () => {
  await buildEverything();
  for (const row of (await outboxRows(w.db)).filter(r => r.op === 'upsert')) {
    const keys = Object.keys(JSON.parse(row.payload));
    for (const banned of [
      'id',
      'user_id',
      'updated_at',
      'deleted',
      'elapsed_ms',
      'completed_at',
    ]) {
      expect(keys).not.toContain(banned);
    }
  }
});

it('delete bodies carry exactly the parents the backend needs', async () => {
  const { list, task, tag } = await buildEverything();
  await w.outbox.markSent((await w.outbox.peekPending(100)).map(e => e.id));
  const sub = (await w.subtasks.listByTask(task.id))[0]!;
  const cls = (await w.classSessions.list())[0]!;
  const ev = (await w.events.list())[0]!;
  await w.subtasks.delete(sub.id);
  await w.tags.removeFromTask(task.id, tag.id);
  await w.classSessions.delete(cls.id);
  await w.events.delete(ev.id);
  await w.tasks.delete(task.id);
  await w.tags.delete(tag.id);
  await w.taskLists.delete(list.id);
  const deletes = (await outboxRows(w.db)).filter(r => r.op === 'delete');
  expect(new Set(deletes.map(r => r.entity))).toEqual(new Set(ENTITIES));
  for (const row of deletes) {
    expect(Object.keys(JSON.parse(row.payload)).sort()).toEqual(
      [...DELETE_FIELDS[row.entity]!].sort(),
    );
    expect(row.entity_id).not.toBe('');
  }
});

it('a task-tag change is identified by <task_id>:<tag_id> and its body, not by a bare id', async () => {
  const { task, tag } = await buildEverything();
  const row = (await outboxRows(w.db)).find(r => r.entity === 'task_tag')!;
  expect(row.entity_id).toBe(`${task.id}:${tag.id}`);
  expect(JSON.parse(row.payload)).toEqual({ task_id: task.id, tag_id: tag.id });
});

it('change ids satisfy the backend rule (1-64 visible ASCII)', async () => {
  await buildEverything();
  for (const row of await outboxRows(w.db)) {
    expect(row.change_id).toMatch(/^[\x21-\x7e]{1,64}$/);
  }
});
