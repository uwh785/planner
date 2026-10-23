import type {
  NewSubtask,
  SubtaskPatch,
  SubtaskRepository,
} from '@/application/ports/repositories';
import { NotFoundError, normalizeSubtask, type Subtask } from '@/domain';
import { subtaskFromRow, subtaskToRow } from '../mappers';
import type { SubtaskRow } from '../rows';
import type { RepoDeps } from './deps';
import { EntityStore } from './EntityStore';
import { subtaskPayload } from './payloads';
import { merge } from './sqlHelpers';

export class SubtaskSqlRepository implements SubtaskRepository {
  private readonly store: EntityStore<Subtask, SubtaskRow>;

  constructor(private readonly deps: RepoDeps) {
    this.store = new EntityStore(
      deps.db,
      {
        entity: 'subtask',
        table: 'subtasks',
        idColumn: 'subtask_id',
        idOf: s => s.id,
        toRow: subtaskToRow,
        fromRow: subtaskFromRow,
        normalize: normalizeSubtask,
        payload: subtaskPayload,
        // The backend matches a subtask delete on its parent task too.
        deletePayload: s => ({ task_id: s.taskId }),
      },
      deps.outbox,
      deps.clock,
    );
  }

  create(input: NewSubtask) {
    return this.store.create(
      now => ({
        id: this.deps.ids.newId('sub'),
        taskId: input.taskId,
        title: input.title,
        completed: input.completed ?? false,
        sortOrder: input.sortOrder ?? 0,
        updatedAt: now,
        deleted: false,
      }),
      async tx => {
        const parent = await tx.query(
          'SELECT 1 FROM tasks WHERE task_id = ? AND deleted = 0',
          [input.taskId],
        );
        if (parent.length === 0) {
          throw new NotFoundError('Task not found', 'task');
        }
      },
    );
  }

  update(id: string, patch: SubtaskPatch) {
    return this.store.update(id, current => merge(current, patch));
  }

  delete(id: string) {
    return this.store.delete(id);
  }

  get(id: string) {
    return this.store.get(id);
  }

  listByTask(taskId: string) {
    return this.store.select(
      'task_id = ?',
      [taskId],
      'sort_order, updated_at, subtask_id',
    );
  }
}
