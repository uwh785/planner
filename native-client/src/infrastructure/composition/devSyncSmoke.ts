import { NetworkError } from '@/application/auth/errors';
import type { AppContainer } from '@/application/container';
import { SyncEngine } from '@/application/sync/SyncEngine';
import { databaseFileName } from '../db/databaseName';
import { initDatabase } from '../db/initDatabase';
import { KeychainSessionStore } from '../security/KeychainSessionStore';
import { SystemClock } from '../system/SystemClock';
import { createAppServices } from './createAppServices';
import { createContainer } from './createContainer';

const SMOKE_SERVICE = 'planner.devsync';
/** Throwaway database: never a real user's planner_<userId>.db. */
const SMOKE_DB_USER = 'syncsmoke';
const TABLES = [
  'tasks',
  'task_lists',
  'subtasks',
  'tags',
  'task_tags',
  'class_sessions',
  'events',
  'outbox',
  'sync_state',
];

function assert(condition: boolean, what: string): asserts condition {
  if (!condition) {
    throw new Error(`sync smoke failed: ${what}`);
  }
}

const log = (message: string) => console.log(`sync smoke: ${message}`);

type Wire = Record<string, unknown>;
const rows = (value: unknown): Wire[] =>
  Array.isArray(value) ? (value as Wire[]) : [];

/**
 * Development-only, end-to-end proof of offline sync against the real
 * backend. It registers a throwaway user, works offline (the connection is
 * faked as down), goes "online", syncs, and checks through the real API that
 * the server holds exactly the expected rows once; then it changes data on
 * the server and checks that a pull brings it down, tombstones included.
 *
 * It uses its own Keychain entry, its own database file (wiped at the start)
 * and a fresh email each run, and logs step names and counts only: never
 * tokens, passwords or entity contents. The sync scheduler is not involved.
 */
export async function runSyncSmoke(apiBaseUrl?: string): Promise<void> {
  if (!__DEV__) {
    return;
  }
  // Start from an empty throwaway database even if an earlier run was killed.
  const { db } = await initDatabase(databaseFileName(SMOKE_DB_USER));
  for (const table of TABLES) {
    await db.execute(`DELETE FROM ${table}`);
  }
  await db.close();

  const store = new KeychainSessionStore(SMOKE_SERVICE);
  const services = createAppServices({
    apiBaseUrl,
    sessionStore: store,
    openContainer: () => createContainer({ userId: SMOKE_DB_USER }),
  });
  await services.ready;
  if (services.session.current()) {
    await services.session.logout();
  }

  await services.session.register({
    email: `m4-smoke-${Date.now()}@example.com`,
    password: 'smoke-password-1',
    name: 'Sync Smoke',
  });
  log('registered a throwaway user');
  const container: AppContainer = await services.containers.acquire();

  let online = false;
  const engine = new SyncEngine({
    outbox: container.outbox,
    syncState: container.syncState,
    remoteChanges: container.remoteChanges,
    http: {
      request: (method, path, options) =>
        online
          ? services.http.request(method, path, options)
          : Promise.reject(new NetworkError('smoke: forced offline')),
    },
    clock: new SystemClock(),
    random: Math.random,
  });
  const api = async (method: string, path: string, body?: unknown) =>
    (await services.http.request(method, path, { body })).json as Wire;
  const snapshot = async () =>
    ((await api('GET', '/api/sync?since=0')).data ?? {}) as Wire;

  try {
    // 1. Work offline with the local repositories.
    const list = await container.taskLists.create({ name: 'Smoke list' });
    const a = await container.tasks.create({ title: 'A', listId: list.id });
    const b = await container.tasks.create({ title: 'B', listId: list.id });
    const c = await container.tasks.create({ title: 'C' });
    await container.subtasks.create({ taskId: a.id, title: 'A step' });
    const tag = await container.tags.create({ name: 'smoke' });
    await container.tags.addToTask(a.id, tag.id);
    await container.tasks.update(b.id, { title: 'B edited' });
    await container.tasks.delete(c.id);
    const waiting = await container.outbox.pendingCount();
    assert(waiting === 6, `six changes queued offline, got ${waiting}`);
    log(`worked offline, ${waiting} changes queued`);

    // 2. A sync while offline changes nothing.
    await engine.sync();
    assert(
      engine.status.getSnapshot().phase === 'offline',
      'engine reports offline',
    );
    assert(
      (await container.outbox.pendingCount()) === waiting,
      'offline sync left the outbox alone',
    );
    log('offline sync kept the outbox');

    // 3. Back online: everything goes up.
    online = true;
    await engine.sync();
    const after = engine.status.getSnapshot();
    assert(
      after.phase === 'idle',
      `engine idle, got ${after.phase}: ${after.lastError ?? 'no error'}`,
    );
    assert((await container.outbox.pendingCount()) === 0, 'outbox drained');
    log('online sync drained the outbox');

    // 4. The server holds exactly the expected rows, once.
    const lists = rows((await api('GET', '/api/lists')).data);
    const tasks = rows((await api('GET', '/api/tasks')).data);
    assert(lists.length === 1 && lists[0]?.list_id === list.id, 'one list');
    assert(tasks.length === 2, `two tasks on the server, got ${tasks.length}`);
    const titles = tasks.map(t => t.title).sort();
    assert(
      titles[0] === 'A' && titles[1] === 'B edited',
      'edited title reached the server and the deleted task never did',
    );
    const full = await snapshot();
    assert(rows(full.lists).length === 1, 'one list in the snapshot');
    assert(rows(full.tasks).length === 2, 'two tasks in the snapshot');
    assert(rows(full.subtasks).length === 1, 'one subtask in the snapshot');
    assert(rows(full.tags).length === 1, 'one tag in the snapshot');
    assert(rows(full.task_tags).length === 1, 'one link in the snapshot');
    log('server has the expected rows exactly once');

    // 5. Replaying the sync changes nothing (no duplicates).
    await engine.sync();
    assert(rows((await snapshot()).tasks).length === 2, 'no duplicates');
    log('a second sync added nothing');

    // 6. A delete of a row the server knows becomes a tombstone there.
    await container.tasks.delete(b.id);
    await engine.sync();
    const afterDelete = rows((await snapshot()).tasks);
    const tomb = afterDelete.find(t => t.task_id === b.id);
    assert(tomb?.deleted === true, 'delete reached the server as a tombstone');
    log('offline delete became a server tombstone');

    // 7. Changes made on the server come down with a pull.
    const s1 = ((await api('POST', '/api/tasks', { title: 'From server 1' }))
      .data ?? {}) as Wire;
    const s2 = ((await api('POST', '/api/tasks', { title: 'From server 2' }))
      .data ?? {}) as Wire;
    await api('PUT', `/api/tasks/${a.id}`, {
      title: 'A edited on server',
      list_id: list.id,
    });
    await engine.sync();
    assert(
      (await container.tasks.get(String(s1.task_id)))?.title ===
        'From server 1',
      'server task 1 pulled',
    );
    assert(
      (await container.tasks.get(String(s2.task_id))) !== null,
      'server task 2 pulled',
    );
    assert(
      (await container.tasks.get(a.id))?.title === 'A edited on server',
      'server edit pulled',
    );
    log('pull brought server creates and edits down');

    await api('DELETE', `/api/tasks/${String(s2.task_id)}`);
    await engine.sync();
    assert(
      (await container.tasks.get(String(s2.task_id))) === null,
      'server delete arrived as a tombstone',
    );
    assert(
      (await container.tasks.get(String(s1.task_id))) !== null,
      'other server task kept',
    );
    log('pull applied a server-side delete');
    log('sync smoke ok');
  } finally {
    services.containers.release();
    await services.session.logout();
  }
}
