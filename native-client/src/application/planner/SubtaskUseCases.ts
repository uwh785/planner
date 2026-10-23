import { NotFoundError, type Subtask } from '@/domain';
import type { SubtaskRepository, TaskRepository } from '../ports/repositories';
import type { Notices } from './Notices';

/**
 * Add, check off, rename and delete the subtasks of a task. Validation is the
 * domain's (the backend's rules: a trimmed title of 1 to 200 bytes, a live
 * parent task). New subtasks are numbered after the last one, so the list
 * keeps the order they were added in whatever is toggled later.
 */
export class SubtaskUseCases {
  constructor(
    private readonly subtasks: SubtaskRepository,
    private readonly tasks: Pick<TaskRepository, 'get'>,
    private readonly notices: Pick<Notices, 'announce'>,
  ) {}

  async add(taskId: string, title: string): Promise<Subtask> {
    if ((await this.tasks.get(taskId)) === null) {
      throw new NotFoundError('Task not found', 'task');
    }
    const existing = await this.subtasks.listByTask(taskId);
    const sortOrder =
      existing.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1;
    const subtask = await this.subtasks.create({ taskId, title, sortOrder });
    this.notices.announce({
      key: 'noticeSubtaskAdded',
      params: { title: subtask.title },
    });
    return subtask;
  }

  /** Setting the value it already has writes and queues nothing. */
  async setCompleted(id: string, completed: boolean): Promise<Subtask> {
    const current = await this.found(this.subtasks.get(id));
    if (current.completed === completed) {
      return current;
    }
    return this.found(this.subtasks.update(id, { completed }));
  }

  async rename(id: string, title: string): Promise<Subtask> {
    return this.found(this.subtasks.update(id, { title }));
  }

  /** Removing a subtask that is already gone does nothing. */
  async remove(id: string): Promise<void> {
    const subtask = await this.subtasks.get(id);
    if (subtask !== null && (await this.subtasks.delete(id))) {
      this.notices.announce({
        key: 'noticeSubtaskDeleted',
        params: { title: subtask.title },
      });
    }
  }

  private async found(pending: Promise<Subtask | null>): Promise<Subtask> {
    const subtask = await pending;
    if (subtask === null) {
      throw new NotFoundError('Subtask not found', 'subtask');
    }
    return subtask;
  }
}
