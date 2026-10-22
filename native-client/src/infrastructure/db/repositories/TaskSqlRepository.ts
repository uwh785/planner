import type {
  NewTask,
  TaskFilter,
  TaskPatch,
  TaskRepository,
} from '@/application/ports/repositories';
import type { SqlDatabase, SqlValue } from '@/application/ports/SqlDatabase';
import { taskTagEntityId } from '@/application/sync/entityIds';
import { normalizeTask, type Task } from '@/domain';
import { taskFromRow, taskToRow } from '../mappers';
import type { TaskRow } from '../rows';
import type { RepoDeps } from './deps';
import { EntityStore } from './EntityStore';
import { taskPayload } from './payloads';
import { merge } from './sqlHelpers';

export class TaskSqlRepository implements TaskRepository {
  private readonly store: EntityStore<Task, TaskRow>;

  constructor(private readonly deps: RepoDeps) {
    this.store = new EntityStore(
      deps.db,
      {
        entity: 'task',
        table: 'tasks',
        idColumn: 'task_id',
        idOf: t => t.id,
        toRow: taskToRow,
        fromRow: taskFromRow,
        normalize: normalizeTask,
        payload: taskPayload,
        deletePayload: () => ({}),
      },
      deps.outbox,
      deps.clock,
    );
  }

  create(input: NewTask) {
    return this.store.create(now => ({
      id: this.deps.ids.newId('tsk'),
      listId: input.listId ?? null,
      title: input.title,
      description: input.description ?? '',
      priority: input.priority ?? 0,
      status: input.status ?? 'pending',
      dueDate: input.dueDate ?? null,
      dueAllDay: input.dueAllDay ?? false,
      durationMs: input.durationMs ?? null,
      startedAt: null,
      elapsedMs: 0,
      completedAt: null,
      sortOrder: input.sortOrder ?? 0,
      updatedAt: now,
      deleted: false,
    }));
  }

  update(id: string, patch: TaskPatch) {
    return this.store.update(id, current => merge(current, patch));
  }

  /**
   * Like the backend's DeleteTask nothing else is tombstoned, except when the
   * server never saw the task: its subtasks and links could never be pushed
   * (the parent does not exist there), so they are purged with it.
   */
  delete(id: string) {
    return this.store.delete(id, {
      after: async (tx, task, dropped) => {
        if (dropped) {
          await this.purgeChildren(tx, task.id);
        }
      },
    });
  }

  get(id: string) {
    return this.store.get(id);
  }

  list(filter: TaskFilter = {}) {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (filter.listId === null) {
      where.push('list_id IS NULL');
    } else if (filter.listId !== undefined) {
      where.push('list_id = ?');
      params.push(filter.listId);
    }
    if (filter.status !== undefined) {
      where.push('status = ?');
      params.push(filter.status);
    }
    return this.store.select(
      where.join(' AND '),
      params,
      'sort_order, updated_at, task_id',
    );
  }

  /** Moves every live task of a list to "no list", queuing each update. */
  async detachFromList(tx: SqlDatabase, listId: string): Promise<void> {
    const rows = await tx.query<{ task_id: string }>(
      'SELECT task_id FROM tasks WHERE list_id = ? AND deleted = 0 ORDER BY task_id',
      [listId],
    );
    for (const { task_id } of rows) {
      await this.store.updateIn(tx, task_id, t => ({ ...t, listId: null }));
    }
  }

  private async purgeChildren(tx: SqlDatabase, taskId: string): Promise<void> {
    const subtasks = await tx.query<{ subtask_id: string }>(
      'SELECT subtask_id FROM subtasks WHERE task_id = ?',
      [taskId],
    );
    for (const { subtask_id } of subtasks) {
      await this.deps.outbox.discard(tx, 'subtask', subtask_id);
    }
    await tx.execute('DELETE FROM subtasks WHERE task_id = ?', [taskId]);
    const links = await tx.query<{ tag_id: string }>(
      'SELECT tag_id FROM task_tags WHERE task_id = ?',
      [taskId],
    );
    for (const { tag_id } of links) {
      await this.deps.outbox.discard(
        tx,
        'task_tag',
        taskTagEntityId(taskId, tag_id),
      );
    }
    await tx.execute('DELETE FROM task_tags WHERE task_id = ?', [taskId]);
  }
}
