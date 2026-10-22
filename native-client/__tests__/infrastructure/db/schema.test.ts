import type { SqlDatabase } from '@/application/ports/SqlDatabase';
import { NodeSqliteDatabase } from '@/infrastructure/db/NodeSqliteDatabase';
import { migrations } from '@/infrastructure/db/migrations';
import { runMigrations } from '@/infrastructure/db/migrations/runner';

describe('schema v1', () => {
  let db: SqlDatabase;
  beforeEach(async () => {
    db = NodeSqliteDatabase.openInMemory();
    await runMigrations(db, migrations);
  });
  afterEach(() => db.close());

  const one = async (sql: string, params: (string | number | null)[] = []) =>
    (await db.query<Record<string, unknown>>(sql, params))[0];

  it('stores a task list with backend defaults', async () => {
    await db.execute('INSERT INTO task_lists (list_id, name) VALUES (?, ?)', [
      'l1',
      'Inbox',
    ]);
    expect(await one('SELECT * FROM task_lists')).toEqual({
      list_id: 'l1',
      name: 'Inbox',
      color: '#0A84FF',
      icon: 'list',
      sort_order: 0,
      updated_at: 0,
      deleted: 0,
    });
  });

  it('stores a task with no list and backend defaults', async () => {
    await db.execute('INSERT INTO tasks (task_id, title) VALUES (?, ?)', [
      't1',
      'Write tests',
    ]);
    expect(await one('SELECT * FROM tasks')).toEqual({
      task_id: 't1',
      list_id: null,
      title: 'Write tests',
      description: '',
      priority: 0,
      status: 'pending',
      due_date: null,
      due_all_day: 0,
      duration_ms: null,
      started_at: null,
      elapsed_ms: 0,
      completed_at: null,
      sort_order: 0,
      updated_at: 0,
      deleted: 0,
    });
  });

  it('stores subtasks, tags, task_tags, classes and events', async () => {
    await db.execute('INSERT INTO subtasks (subtask_id, task_id, title) VALUES (?, ?, ?)', ['s1', 't1', 'Step']);
    await db.execute('INSERT INTO tags (tag_id, name) VALUES (?, ?)', ['g1', 'home']);
    await db.execute('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', ['t1', 'g1']);
    await db.execute(
      'INSERT INTO class_sessions (class_id, subject, day_of_week, start_minute, end_minute) VALUES (?, ?, ?, ?, ?)',
      ['c1', 'MATH', 2, 480, 540],
    );
    await db.execute('INSERT INTO events (event_id, title, start_at) VALUES (?, ?, ?)', ['e1', 'Dentist', 1000]);

    expect(await one('SELECT completed, deleted FROM subtasks')).toEqual({ completed: 0, deleted: 0 });
    expect(await one('SELECT color, deleted FROM tags')).toEqual({ color: '#8E8E93', deleted: 0 });
    expect(await one('SELECT updated_at, deleted FROM task_tags')).toEqual({ updated_at: 0, deleted: 0 });
    expect(await one('SELECT room, teacher, color FROM class_sessions')).toEqual({ room: '', teacher: '', color: '#0A84FF' });
    expect(await one('SELECT description, location, end_at, all_day, color FROM events')).toEqual({
      description: '',
      location: '',
      end_at: null,
      all_day: 0,
      color: '#0A84FF',
    });
  });

  it('keeps tombstones as rows and lets a later pull upsert over them', async () => {
    await db.execute('INSERT INTO tasks (task_id, title) VALUES (?, ?)', ['t1', 'x']);
    await db.execute('UPDATE tasks SET deleted = 1, updated_at = ? WHERE task_id = ?', [5, 't1']);
    expect(await one('SELECT deleted, updated_at FROM tasks')).toEqual({ deleted: 1, updated_at: 5 });
    expect(await db.query('SELECT task_id FROM tasks WHERE deleted = 0')).toEqual([]);
    await db.execute(
      'INSERT OR REPLACE INTO tasks (task_id, title, updated_at, deleted) VALUES (?, ?, ?, ?)',
      ['t1', 'x', 9, 0],
    );
    expect(await one('SELECT deleted, updated_at FROM tasks')).toEqual({ deleted: 0, updated_at: 9 });
  });

  it('keys task_tags on (task_id, tag_id)', async () => {
    await db.execute('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', ['t1', 'g1']);
    await expect(db.execute('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', ['t1', 'g1'])).rejects.toBeDefined();
    await db.execute('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', ['t1', 'g2']);
  });

  it('enforces the backend class and event invariants', async () => {
    await expect(
      db.execute(
        'INSERT INTO class_sessions (class_id, subject, day_of_week, start_minute, end_minute) VALUES (?, ?, ?, ?, ?)',
        ['c1', 'X', 7, 0, 10],
      ),
    ).rejects.toBeDefined();
    await expect(
      db.execute('INSERT INTO events (event_id, title, start_at, end_at) VALUES (?, ?, ?, ?)', ['e1', 'X', 10, 5]),
    ).rejects.toBeDefined();
  });

  it('stores sync state and outbox entries with unique change ids', async () => {
    await db.execute('INSERT INTO sync_state (key, value) VALUES (?, ?)', ['cursor', '123']);
    expect(await one('SELECT value FROM sync_state WHERE key = ?', ['cursor'])).toEqual({ value: '123' });

    await db.execute(
      'INSERT INTO outbox (entity, op, entity_id, payload, change_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['task', 'upsert', 't1', '{"title":"x"}', 'c-1', 1000],
    );
    expect(await one('SELECT id, attempts, last_error, status FROM outbox')).toEqual({
      id: 1,
      attempts: 0,
      last_error: null,
      status: 'pending',
    });
    await expect(
      db.execute(
        'INSERT INTO outbox (entity, op, entity_id, payload, change_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['task', 'upsert', 't1', '{}', 'c-1', 1001],
      ),
    ).rejects.toBeDefined();
  });

  it('creates the indexes the UI queries use', async () => {
    const names = (
      await db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")
    ).map(r => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'idx_tasks_list',
        'idx_tasks_status',
        'idx_tasks_due',
        'idx_subtasks_task',
        'idx_outbox_status_id',
      ]),
    );
  });
});
