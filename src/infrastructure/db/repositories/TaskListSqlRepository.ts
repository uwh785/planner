import type {
  NewTaskList,
  TaskListPatch,
  TaskListRepository,
} from '@/application/ports/repositories';
import { normalizeTaskList, type TaskList } from '@/domain';
import { taskListFromRow, taskListToRow } from '../mappers';
import type { TaskListRow } from '../rows';
import type { RepoDeps } from './deps';
import { EntityStore } from './EntityStore';
import { listPayload } from './payloads';
import { merge } from './sqlHelpers';
import type { TaskSqlRepository } from './TaskSqlRepository';

export class TaskListSqlRepository implements TaskListRepository {
  private readonly store: EntityStore<TaskList, TaskListRow>;

  constructor(
    private readonly deps: RepoDeps,
    private readonly tasks: TaskSqlRepository,
  ) {
    this.store = new EntityStore(
      deps.db,
      {
        entity: 'list',
        table: 'task_lists',
        idColumn: 'list_id',
        idOf: l => l.id,
        toRow: taskListToRow,
        fromRow: taskListFromRow,
        normalize: normalizeTaskList,
        payload: listPayload,
        deletePayload: () => ({}),
      },
      deps.outbox,
      deps.clock,
    );
  }

  create(input: NewTaskList) {
    return this.store.create(now => ({
      id: this.deps.ids.newId('lst'),
      name: input.name,
      color: input.color ?? '',
      icon: input.icon ?? '',
      sortOrder: input.sortOrder ?? 0,
      updatedAt: now,
      deleted: false,
    }));
  }

  update(id: string, patch: TaskListPatch) {
    return this.store.update(id, current => merge(current, patch));
  }

  delete(id: string) {
    return this.store.delete(id, {
      before: (tx, list) => this.tasks.detachFromList(tx, list.id),
    });
  }

  get(id: string) {
    return this.store.get(id);
  }

  list() {
    return this.store.select('', [], 'sort_order, updated_at, list_id');
  }
}
