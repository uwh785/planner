import type {
  NewTask,
  TaskFilter,
  TaskOrder,
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

const ORDER_BY: Record<TaskOrder, string> = {
  default: 'sort_order, updated_at, task_id',
  // rowid is insertion order: the closest thing to "created order" locally.
  plan: 'sort_order, due_date IS NULL, due_date, rowid',
  recentlyCompleted: 'completed_at DESC, rowid DESC',
};

/** The web's overdue rule (backend `overdueCondition`); two `now` parameters. */
const OVERDUE_SQL =
  "(due_date IS NOT NULL AND status <> 'completed' AND " +
  '((due_all_day = 0 AND due_date < ?) OR ' +
  '(due_all_day = 1 AND due_date + 86400000 <= ?)))';

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
    const { where, params } = this.whereOf(filter);
    return this.store.select(
      where,
      params,
      ORDER_BY[filter.order ?? 'default'],
      filter.limit,
    );
  }

  count(filter: TaskFilter = {}) {
    const { where, params } = this.whereOf(filter);
    return this.store.count(where, params);
  }

  async countOpenByList() {
    const rows = await this.deps.db.query<{
      list_id: string | null;
      n: number;
    }>(
      `SELECT list_id, COUNT(*) AS n FROM tasks
       WHERE deleted = 0 AND status <> 'completed' GROUP BY list_id`,
    );
    return new Map(rows.map(row => [row.list_id, row.n] as const));
  }

  /**
   * Local state and the queued `complete` change together. A task the server
   * has never seen keeps its pending create in front of the completion (the
   * create body says "pending"), so the server creates it and then completes
   * it at the real moment. An in-progress task folds its running segment into
   * the elapsed time, as the backend does.
   */
  complete(id: string, at: number) {
    return this.store.transition(
      id,
      task => {
        if (task.status === 'completed') {
          return null;
        }
        const running =
          task.status === 'in_progress' && task.startedAt !== null
            ? Math.max(at - task.startedAt, 0)
            : 0;
        return {
          ...task,
          status: 'completed',
          completedAt: at,
          startedAt: null,
          elapsedMs: task.elapsedMs + running,
        };
      },
      (tx, task) => this.deps.outbox.complete(tx, task.id, at),
    );
  }

  private whereOf(filter: TaskFilter) {
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
    if (filter.overdueAt !== undefined) {
      where.push(OVERDUE_SQL);
      params.push(filter.overdueAt, filter.overdueAt);
    }
    if (filter.completion === 'open') {
      where.push("status <> 'completed'");
    } else if (filter.completion === 'completed') {
      where.push("status = 'completed'");
    }
    return { where: where.join(' AND '), params };
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
