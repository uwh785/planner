import type { Subtask, Task, TaskList } from '@/domain';
import type { ChangeSource } from '../ports/ChangeNotifier';
import type { Clock } from '../ports/Clock';
import type {
  SubtaskRepository,
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

/** The most active (in progress) tasks the dashboard shows, like the web's. */
export const ACTIVE_TASK_LIMIT = 10;

/** The web's task filters. `overdue` is a time rule, the others are statuses. */
export type StatusFilter =
  | 'all'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'overdue';

/**
 * Which tasks a screen shows: one list or every list (`listId` omitted),
 * narrowed by a status filter (omitted means `all`).
 */
export interface TaskScope {
  listId?: string;
  status?: StatusFilter;
}

export interface ListSummary {
  list: TaskList;
  openCount: number;
}

export interface ListsOverview {
  lists: ListSummary[];
}

export interface DashboardCounts {
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export interface DashboardData {
  counts: DashboardCounts;
  /** In-progress tasks, at most `ACTIVE_TASK_LIMIT`. */
  active: Task[];
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

/** What the task detail screen shows: the task, its list and its subtasks. */
export interface TaskDetailData {
  task: Task;
  /** Null when the task has no list (or its list was deleted). */
  list: TaskList | null;
  /** In the order they were added. */
  subtasks: Subtask[];
}

export interface QueryLimits {
  openLimit?: number;
  completedLimit?: number;
}

export interface PlannerQuerySource {
  taskLists: TaskListRepository;
  tasks: TaskRepository;
  subtasks: SubtaskRepository;
  /** Local writes and applied pulls. */
  dataChanges: ChangeSource;
  /** "Now" for the overdue rule. */
  clock: Clock;
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
    return {
      lists: lists.map(list => ({ list, openCount: counts.get(list.id) ?? 0 })),
    };
  }

  /** The four counters and the in-progress tasks, as the web's Panel shows. */
  async dashboard(): Promise<DashboardData> {
    const { tasks, clock } = this.source;
    const now = clock.now();
    const [pending, inProgress, completed, overdue, active] = await Promise.all(
      [
        tasks.count({ status: 'pending' }),
        tasks.count({ status: 'in_progress' }),
        tasks.count({ status: 'completed' }),
        tasks.count({ overdueAt: now }),
        tasks.list({
          status: 'in_progress',
          order: 'plan',
          limit: ACTIVE_TASK_LIMIT,
        }),
      ],
    );
    return { counts: { pending, inProgress, completed, overdue }, active };
  }

  async tasks(
    scope: TaskScope,
    limits: QueryLimits = {},
  ): Promise<TaskSections> {
    const { tasks, clock } = this.source;
    const status = scope.status ?? 'all';
    const where: TaskFilter =
      scope.listId === undefined ? {} : { listId: scope.listId };
    const openLimit = limits.openLimit ?? OPEN_TASK_LIMIT;
    const completedLimit = limits.completedLimit ?? COMPLETED_TASK_LIMIT;

    // What the open and the completed section hold for each filter.
    const open: TaskFilter | null =
      status === 'completed'
        ? null
        : status === 'all'
        ? { ...where, completion: 'open' }
        : status === 'overdue'
        ? { ...where, overdueAt: clock.now() }
        : { ...where, status };
    const completed: TaskFilter | null =
      status === 'all' || status === 'completed'
        ? { ...where, completion: 'completed' }
        : null;

    const none = Promise.resolve<Task[]>([]);
    const zero = Promise.resolve(0);
    const [openRows, completedRows, openTotal, completedTotal] =
      await Promise.all([
        open ? tasks.list({ ...open, order: 'plan', limit: openLimit }) : none,
        completed
          ? tasks.list({
              ...completed,
              order: 'recentlyCompleted',
              limit: completedLimit,
            })
          : none,
        open ? tasks.count(open) : zero,
        completed ? tasks.count(completed) : zero,
      ]);
    return {
      open: openRows,
      completed: completedRows,
      openTotal,
      completedTotal,
    };
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

  /** Null when the task does not exist (or was deleted). */
  async taskDetail(id: string): Promise<TaskDetailData | null> {
    const { tasks, taskLists, subtasks } = this.source;
    const task = await tasks.get(id);
    if (task === null) {
      return null;
    }
    const [list, rows] = await Promise.all([
      task.listId === null ? Promise.resolve(null) : taskLists.get(task.listId),
      subtasks.listByTask(id),
    ]);
    return { task, list, subtasks: rows };
  }

  watchOverview(): LiveQuery<ListsOverview> {
    return this.watch(() => this.overview());
  }

  watchDashboard(): LiveQuery<DashboardData> {
    return this.watch(() => this.dashboard());
  }

  watchTasks(scope: TaskScope): LiveQuery<TaskSections> {
    return this.watch(() => this.tasks(scope));
  }

  watchList(id: string): LiveQuery<TaskList | null> {
    return this.watch(() => this.list(id));
  }

  watchTaskDetail(id: string): LiveQuery<TaskDetailData | null> {
    return this.watch(() => this.taskDetail(id));
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
