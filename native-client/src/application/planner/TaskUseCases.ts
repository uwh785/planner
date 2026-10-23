import {
  isPriority,
  NotFoundError,
  ValidationError,
  type Priority,
  type Task,
} from '@/domain';
import type {
  TaskListRepository,
  TaskPatch,
  TaskRepository,
} from '../ports/repositories';
import type { Notices } from './Notices';

/** What the edit screen can change. Omitted fields stay as they are. */
export interface TaskChanges {
  title?: string;
  description?: string;
  priority?: Priority;
  /** Epoch ms; midnight local time when `dueAllDay`. Null clears the date. */
  dueDate?: number | null;
  dueAllDay?: boolean;
  /** Estimated duration in ms for the countdown; null clears it. */
  durationMs?: number | null;
  listId?: string | null;
}

/**
 * Create (title only), edit and delete a task. Completion is CompletionWindow;
 * start and pause are TaskTimerUseCases.
 */
export class TaskUseCases {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lists: Pick<TaskListRepository, 'get'>,
    private readonly notices: Pick<Notices, 'announce'>,
  ) {}

  async addQuick(title: string, listId: string | null): Promise<Task> {
    await this.requireList(listId);
    const task = await this.tasks.create({ title, listId });
    this.notices.announce({
      key: 'noticeAdded',
      params: { title: task.title },
    });
    return task;
  }

  async edit(id: string, changes: TaskChanges): Promise<Task> {
    this.validate(changes);
    await this.requireList(changes.listId ?? null);
    const patch: TaskPatch = { ...changes };
    const task = await this.tasks.update(id, patch);
    if (task === null) {
      throw new NotFoundError('Task not found', 'task');
    }
    this.notices.announce({
      key: 'noticeSaved',
      params: { title: task.title },
    });
    return task;
  }

  /** Deleting a task that is already gone does nothing. */
  async remove(id: string): Promise<void> {
    const task = await this.tasks.get(id);
    if (task !== null && (await this.tasks.delete(id))) {
      this.notices.announce({
        key: 'noticeDeleted',
        params: { title: task.title },
      });
    }
  }

  private validate(changes: TaskChanges): void {
    if (changes.priority !== undefined && !isPriority(changes.priority)) {
      throw new ValidationError('priority must be 0 (none) to 3 (high)');
    }
    const due = changes.dueDate;
    if (due != null && (!Number.isInteger(due) || due <= 0)) {
      throw new ValidationError('due date is not valid');
    }
    const duration = changes.durationMs;
    if (duration != null && (!Number.isInteger(duration) || duration <= 0)) {
      throw new ValidationError('duration must be a positive number of ms');
    }
    if (
      changes.dueAllDay !== undefined &&
      typeof changes.dueAllDay !== 'boolean'
    ) {
      throw new ValidationError('all day must be true or false');
    }
  }

  private async requireList(listId: string | null): Promise<void> {
    if (listId !== null && (await this.lists.get(listId)) === null) {
      throw new NotFoundError('List not found', 'list');
    }
  }
}
