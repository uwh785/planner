import { taskTagEntityId } from '@/application/sync/entityIds';
import {
  openTestWorld,
  outboxRows,
  outboxSummary,
  rawRows,
  type TestWorld,
} from '../../helpers/testRepositories';

let w: TestWorld;
let taskId: string;
let tagId: string;
beforeEach(async () => {
  w = await openTestWorld();
  taskId = (await w.tasks.create({ title: 't' })).id;
  tagId = (await w.tags.create({ name: 'g' })).id;
  const pending = await w.outbox.peekPending(10);
  await w.outbox.markSent(pending.map(e => e.id));
});
afterEach(() => w.db.close());

const linkId = () => taskTagEntityId(taskId, tagId);

it('encodes the entity id as <task_id>:<tag_id>', () => {
  expect(linkId()).toBe(`${taskId}:${tagId}`);
});

it('adds a link with a {task_id, tag_id} body', async () => {
  await w.tags.addToTask(taskId, tagId);
  const [entry] = await outboxRows(w.db);
  expect(entry).toMatchObject({
    entity: 'task_tag',
    op: 'upsert',
    entity_id: linkId(),
    origin: 'create',
  });
  expect(JSON.parse(entry!.payload)).toEqual({
    task_id: taskId,
    tag_id: tagId,
  });
  expect((await w.tags.tagsForTask(taskId)).map(t => t.id)).toEqual([tagId]);
});

it('adding an existing live link changes nothing', async () => {
  await w.tags.addToTask(taskId, tagId);
  await w.tags.addToTask(taskId, tagId);
  expect(await w.outbox.pendingCount()).toBe(1);
  expect(await rawRows(w.db, 'task_tags')).toHaveLength(1);
});

it('add then remove before any push drops both and the row', async () => {
  await w.tags.addToTask(taskId, tagId);
  await w.tags.removeFromTask(taskId, tagId);
  expect(await outboxRows(w.db)).toEqual([]);
  expect(await rawRows(w.db, 'task_tags')).toEqual([]);
});

it('removing a pushed link keeps a tombstone and queues a delete with ids in the body', async () => {
  await w.tags.addToTask(taskId, tagId);
  await w.outbox.markSent((await w.outbox.peekPending(10)).map(e => e.id));
  w.clock.tick();
  await w.tags.removeFromTask(taskId, tagId);
  const [entry] = await outboxRows(w.db);
  expect(entry).toMatchObject({
    entity: 'task_tag',
    op: 'delete',
    entity_id: linkId(),
  });
  expect(JSON.parse(entry!.payload)).toEqual({
    task_id: taskId,
    tag_id: tagId,
  });
  expect(await rawRows(w.db, 'task_tags')).toMatchObject([
    { deleted: 1, updated_at: w.clock.current },
  ]);
  expect(await w.tags.tagsForTask(taskId)).toEqual([]);
});

it('adding after a local tombstone resurrects the link and replaces the pending delete', async () => {
  await w.tags.addToTask(taskId, tagId);
  await w.outbox.markSent((await w.outbox.peekPending(10)).map(e => e.id));
  await w.tags.removeFromTask(taskId, tagId);
  w.clock.tick();
  await w.tags.addToTask(taskId, tagId);
  expect(await outboxSummary(w.db)).toEqual([`task_tag:upsert:${linkId()}`]);
  expect((await outboxRows(w.db))[0]!.origin).toBe('update');
  expect(await rawRows(w.db, 'task_tags')).toMatchObject([
    { deleted: 0, updated_at: w.clock.current },
  ]);
  expect((await w.tags.tagsForTask(taskId)).map(t => t.id)).toEqual([tagId]);
});

it('remove of a link that is not there is a no-op', async () => {
  await w.tags.removeFromTask(taskId, tagId);
  expect(await outboxRows(w.db)).toEqual([]);
});

it('refuses links to a task or tag that does not exist locally', async () => {
  await expect(w.tags.addToTask('tsk_missing', tagId)).rejects.toThrow(
    /task not found/i,
  );
  await expect(w.tags.addToTask(taskId, 'tag_missing')).rejects.toThrow(
    /tag not found/i,
  );
  expect(await outboxRows(w.db)).toEqual([]);
});

it('hides links whose tag is tombstoned', async () => {
  await w.tags.addToTask(taskId, tagId);
  await w.outbox.markSent((await w.outbox.peekPending(10)).map(e => e.id));
  await w.tags.delete(tagId);
  expect(await w.tags.tagsForTask(taskId)).toEqual([]);
});
