import type { Task, TaskList } from '@/domain';
import type { ChangeSource } from '../ports/ChangeNotifier';
import type {
  TaskFilter,
  TaskListRepository,
  TaskRepository,
} from '../ports/repositories';
import { LiveQuery, type Idleable } from './LiveQuery';

/**
 * The backend's plan ceiling is 5000 tasks, so loading every open task of a
 * scope is bounded; the done pile is capped lower and reported with its
 * real total, since it only ever grows.
 */
export const OPEN_TASK_LIMIT = 5000;
export const COMPLETED_TASK_LIMIT = 200;

/** Which tasks a screen shows: one list, or all tasks when `listId` is omitted. */
export interface TaskScope {
  listId?: string;
}

export interface ListSummary {
  list: TaskList;
  openCount: number;
}

export interface ListsOverview {
  /** Open tasks everywhere, including those without a list. */
  allOpenCount: number;
  lists: ListSummary[];
}

export interface TaskSections {
  /** Sort order, then due date (undated last), then creation order. */
  open: Task[];
  /** Latest completion first. */
  completed: Task[];
  openTotal: number;
  completedTotal: number;
}

export interface TaskEditData {
  task: Task;
  /** Every list, for the list picker. */
  lists: TaskList[];
}

export interface QueryLimits {
  openLimit?: number;
  completedLimit?: number;
}

export interface PlannerQuerySource {
  taskLists: TaskListRepository;
  tasks: TaskRepository;
  /** Local writes and applied pulls. */
  dataChanges: ChangeSource;
}

/**
 * What the screens read, as plain async queries and as live ones that rerun
 * when local data changes. Pure application code: no React, no SQL.
 */
export class PlannerQueries {
  private readonly active = new Set<Idleable>();

  constructor(private readonly source: PlannerQuerySource) {}

  async overview(): Promise<ListsOverview> {
    const { taskLists, tasks } = this.source;
    const [lists, counts] = await Promise.all([
      taskLists.list(),
      tasks.countOpenByList(),
    ]);
    let allOpenCount = 0;
    counts.forEach(n => {
      allOpenCount += n;
    });
    return {
      allOpenCount,
      lists: lists.map(list => ({ list, openCount: counts.get(list.id) ?? 0 })),
    };
  }

  async tasks(scope: TaskScope, limits: QueryLimits = {}): Promise<TaskSections> {
    const { tasks } = this.source;
    const where: TaskFilter =
      scope.listId === undefined ? {} : { listId: scope.listId };
    const [open, completed, openTotal, completedTotal] = await Promise.all([
      tasks.list({
        ...where,
        completion: 'open',
        order: 'plan',
        limit: limits.openLimit ?? OPEN_TASK_LIMIT,
      }),
      tasks.list({
        ...where,
        completion: 'completed',
        order: 'recentlyCompleted',
        limit: limits.completedLimit ?? COMPLETED_TASK_LIMIT,
      }),
      tasks.count({ ...where, completion: 'open' }),
      tasks.count({ ...where, completion: 'completed' }),
    ]);
    return { open, completed, openTotal, completedTotal };
  }

  list(id: string): Promise<TaskList | null> {
    return this.source.taskLists.get(id);
  }

  async taskEdit(id: string): Promise<TaskEditData | null> {
    const [task, lists] = await Promise.all([
      this.source.tasks.get(id),
      this.source.taskLists.list(),
    ]);
    return task === null ? null : { task, lists };
  }

  watchOverview(): LiveQuery<ListsOverview> {
    return this.watch(() => this.overview());
  }

  watchTasks(scope: TaskScope): LiveQuery<TaskSections> {
    return this.watch(() => this.tasks(scope));
  }

  watchList(id: string): LiveQuery<TaskList | null> {
    return this.watch(() => this.list(id));
  }

  watchTaskEdit(id: string): LiveQuery<TaskEditData | null> {
    return this.watch(() => this.taskEdit(id));
  }

  /** Resolves once every query a screen is showing has caught up. */
  async settled(): Promise<void> {
    await Promise.all([...this.active].map(query => query.idle()));
  }

  private watch<T>(fetch: () => Promise<T>): LiveQuery<T> {
    return new LiveQuery(fetch, this.source.dataChanges, {
      onActive: query => this.active.add(query),
      onInactive: query => this.active.delete(query),
    });
  }
}
