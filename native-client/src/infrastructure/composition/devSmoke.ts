import { ID_PREFIXES } from '@/application/ports/IdGenerator';
import { databaseFileName } from '../db/databaseName';
import { initDatabase } from '../db/initDatabase';
import { buildContainer } from './createContainer';

const ID_SHAPE = /^(lst|tsk)_[0-9a-f]{16}$/;

function assert(condition: boolean, what: string): void {
  if (!condition) {
    throw new Error(`repo smoke failed: ${what}`);
  }
}

/**
 * Development-only check of the repositories on a real device. It runs on a
 * throwaway database file, never the user's, and leaves nothing behind: the
 * rows are created and deleted before they were ever pushed, so the outbox
 * returns to empty. Logs `repo smoke ok (outbox=N)` with N the entries queued
 * by the two creates.
 */
export async function runRepoSmoke(): Promise<void> {
  const { db, schemaVersion } = await initDatabase(
    databaseFileName('devsmoke'),
  );
  const container = buildContainer(db, schemaVersion);
  try {
    // Start clean even if an earlier run was killed halfway.
    for (const table of ['tasks', 'task_lists', 'outbox']) {
      await db.execute(`DELETE FROM ${table}`);
    }
    const list = await container.taskLists.create({ name: 'Smoke list' });
    const task = await container.tasks.create({
      title: 'Smoke task',
      listId: list.id,
    });
    assert(ID_SHAPE.test(list.id), `list id shape ${list.id}`);
    assert(ID_SHAPE.test(task.id), `task id shape ${task.id}`);
    assert(list.id.startsWith(ID_PREFIXES.list), 'list prefix');
    assert(
      (await container.taskLists.get(list.id))?.name === 'Smoke list',
      'list read back',
    );
    assert(
      (await container.tasks.list({ listId: list.id })).length === 1,
      'task read back',
    );
    const queued = await container.outbox.pendingCount();
    assert(queued === 2, `outbox after creates is ${queued}`);

    await container.tasks.delete(task.id);
    await container.taskLists.delete(list.id);
    assert(
      (await container.outbox.pendingCount()) === 0,
      'outbox drained by offline deletes',
    );
    assert((await container.tasks.list()).length === 0, 'tasks gone');

    console.log(`repo smoke ids ${list.id} ${task.id}`);
    console.log(`repo smoke ok (outbox=${queued})`);
  } finally {
    await container.close();
  }
}
