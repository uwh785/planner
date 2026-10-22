import type {
  ClassSession,
  Event,
  Subtask,
  Tag,
  Task,
  TaskList,
  TaskTag,
} from '@/domain';
import { NodeSqliteDatabase } from '@/infrastructure/db/NodeSqliteDatabase';
import { migrations } from '@/infrastructure/db/migrations';
import { runMigrations } from '@/infrastructure/db/migrations/runner';
import * as m from '@/infrastructure/db/mappers';

const list: TaskList = { id: 'l1', name: 'Inbox', color: '#fff', icon: 'list', sortOrder: 2, updatedAt: 10, deleted: false };
const task: Task = {
  id: 't1', listId: 'l1', title: 'Write', description: 'd', priority: 3, status: 'in_progress',
  dueDate: 1000, dueAllDay: true, durationMs: 60000, startedAt: 500, elapsedMs: 42, completedAt: null,
  sortOrder: 1, updatedAt: 11, deleted: false,
};
const subtask: Subtask = { id: 's1', taskId: 't1', title: 'Step', completed: true, sortOrder: 0, updatedAt: 12, deleted: false };
const tag: Tag = { id: 'g1', name: 'home', color: '#000', updatedAt: 13, deleted: true };
const taskTag: TaskTag = { taskId: 't1', tagId: 'g1', updatedAt: 14, deleted: false };
const cls: ClassSession = { id: 'c1', subject: 'MATH', dayOfWeek: 2, startMinute: 480, endMinute: 540, room: 'A1', teacher: 'Ana', color: '#abc', updatedAt: 15, deleted: false };
const event: Event = { id: 'e1', title: 'Dentist', description: '', location: 'Clinic', startAt: 1000, endAt: null, allDay: false, color: '#abc', updatedAt: 16, deleted: true };

describe('row mappers', () => {
  it('maps domain to snake_case rows with integer booleans', () => {
    expect(m.taskToRow(task)).toEqual({
      task_id: 't1', list_id: 'l1', title: 'Write', description: 'd', priority: 3, status: 'in_progress',
      due_date: 1000, due_all_day: 1, duration_ms: 60000, started_at: 500, elapsed_ms: 42, completed_at: null,
      sort_order: 1, updated_at: 11, deleted: 0,
    });
    expect(m.subtaskToRow(subtask)).toMatchObject({ subtask_id: 's1', task_id: 't1', completed: 1 });
    expect(m.tagToRow(tag)).toMatchObject({ tag_id: 'g1', deleted: 1 });
    expect(m.taskTagToRow(taskTag)).toEqual({ task_id: 't1', tag_id: 'g1', updated_at: 14, deleted: 0 });
    expect(m.classSessionToRow(cls)).toMatchObject({ class_id: 'c1', day_of_week: 2, start_minute: 480, end_minute: 540 });
    expect(m.eventToRow(event)).toMatchObject({ event_id: 'e1', start_at: 1000, end_at: null, all_day: 0, deleted: 1 });
    expect(m.taskListToRow(list)).toMatchObject({ list_id: 'l1', sort_order: 2 });
  });

  it('round-trips every entity', () => {
    expect(m.taskListFromRow(m.taskListToRow(list))).toEqual(list);
    expect(m.taskFromRow(m.taskToRow(task))).toEqual(task);
    expect(m.taskFromRow(m.taskToRow({ ...task, listId: null }))).toEqual({ ...task, listId: null });
    expect(m.subtaskFromRow(m.subtaskToRow(subtask))).toEqual(subtask);
    expect(m.tagFromRow(m.tagToRow(tag))).toEqual(tag);
    expect(m.taskTagFromRow(m.taskTagToRow(taskTag))).toEqual(taskTag);
    expect(m.classSessionFromRow(m.classSessionToRow(cls))).toEqual(cls);
    expect(m.eventFromRow(m.eventToRow(event))).toEqual(event);
  });

  it('rejects a task row with an unknown status or priority', () => {
    const row = m.taskToRow(task);
    expect(() => m.taskFromRow({ ...row, status: 'weird' })).toThrow(/status/);
    expect(() => m.taskFromRow({ ...row, priority: 9 })).toThrow(/priority/);
  });

  it('survives a trip through SQLite', async () => {
    const db = NodeSqliteDatabase.openInMemory();
    await runMigrations(db, migrations);
    const row = m.taskToRow(task);
    const cols = Object.keys(row);
    await db.execute(
      `INSERT INTO tasks (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      Object.values(row),
    );
    const [stored] = await db.query<ReturnType<typeof m.taskToRow>>('SELECT * FROM tasks');
    expect(stored && m.taskFromRow(stored)).toEqual(task);
    await db.close();
  });
});
