import type {
  ClassSession,
  Event,
  Priority,
  Subtask,
  Tag,
  Task,
  TaskList,
  TaskStatus,
} from '@/domain';

/**
 * Local-first repositories. Every mutation changes the local row and queues
 * the matching outbox entry in one transaction; reads never return
 * tombstones. Timer transitions (start, pause, complete) are not here yet.
 *
 * `update` resolves to the new state, or null when the entity does not exist
 * (or is deleted). `delete` resolves to whether anything was deleted.
 * Invalid input rejects with a `ValidationError` and changes nothing.
 */
interface Repository<T, New, Patch> {
  create(input: New): Promise<T>;
  update(id: string, patch: Patch): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  get(id: string): Promise<T | null>;
}

export interface NewTaskList {
  name: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}
export type TaskListPatch = Partial<NewTaskList>;

export interface TaskListRepository
  extends Repository<TaskList, NewTaskList, TaskListPatch> {
  /** By sort order, then update time. */
  list(): Promise<TaskList[]>;
  /**
   * Deleting a list tombstones the list and moves its tasks to "no list"
   * (queued as task updates). The backend would leave those tasks pointing
   * at the deleted list, where any later edit fails to push.
   */
  delete(id: string): Promise<boolean>;
}

export interface NewTask {
  title: string;
  listId?: string | null;
  description?: string;
  priority?: Priority;
  /** Only a create carries a status; later changes are timer transitions (M6). */
  status?: TaskStatus;
  dueDate?: number | null;
  dueAllDay?: boolean;
  durationMs?: number | null;
  sortOrder?: number;
}
export type TaskPatch = Partial<Omit<NewTask, 'status'>>;

export interface TaskFilter {
  /** A list id, or null for tasks without a list. Omit for any list. */
  listId?: string | null;
  status?: TaskStatus;
}

export interface TaskRepository extends Repository<Task, NewTask, TaskPatch> {
  /** By sort order, then update time. */
  list(filter?: TaskFilter): Promise<Task[]>;
  /**
   * Like the backend, deleting a task does not touch its subtasks or tag
   * links. The exception is a task the server never saw: its pending
   * subtasks and links go with it, since they could never be pushed.
   */
  delete(id: string): Promise<boolean>;
}

export interface NewSubtask {
  taskId: string;
  title: string;
  completed?: boolean;
  sortOrder?: number;
}
export type SubtaskPatch = Partial<Omit<NewSubtask, 'taskId'>>;

export interface SubtaskRepository
  extends Repository<Subtask, NewSubtask, SubtaskPatch> {
  listByTask(taskId: string): Promise<Subtask[]>;
}

export interface NewTag {
  name: string;
  color?: string;
}
export type TagPatch = Partial<NewTag>;

export interface TagRepository extends Repository<Tag, NewTag, TagPatch> {
  /** By name. */
  list(): Promise<Tag[]>;
  /**
   * Deleting a tag also tombstones its links locally, without queuing them:
   * the backend's DeleteTag does the same cascade on its side.
   */
  delete(id: string): Promise<boolean>;
  /** No-op when the link is already live. Rejects if the task or tag is missing. */
  addToTask(taskId: string, tagId: string): Promise<void>;
  /** No-op when there is no live link. */
  removeFromTask(taskId: string, tagId: string): Promise<void>;
  tagsForTask(taskId: string): Promise<Tag[]>;
}

export interface NewClassSession {
  subject: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  room?: string;
  teacher?: string;
  color?: string;
}
export type ClassSessionPatch = Partial<NewClassSession>;

export interface ClassSessionRepository
  extends Repository<ClassSession, NewClassSession, ClassSessionPatch> {
  /** By weekday, then start time. */
  list(): Promise<ClassSession[]>;
}

export interface NewEvent {
  title: string;
  startAt: number;
  endAt?: number | null;
  description?: string;
  location?: string;
  allDay?: boolean;
  color?: string;
}
export type EventPatch = Partial<NewEvent>;

export interface EventRepository
  extends Repository<Event, NewEvent, EventPatch> {
  /** By start time. */
  list(): Promise<Event[]>;
}
