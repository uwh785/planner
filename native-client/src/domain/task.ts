import type { SyncMeta } from './syncMeta';

export const TASK_STATUSES = ['pending', 'in_progress', 'completed'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** 0 = none, 1 = low, 2 = medium, 3 = high. */
export const PRIORITIES = [0, 1, 2, 3] as const;
export type Priority = (typeof PRIORITIES)[number];

export const isTaskStatus = (value: unknown): value is TaskStatus =>
  (TASK_STATUSES as readonly unknown[]).includes(value);

export const isPriority = (value: unknown): value is Priority =>
  (PRIORITIES as readonly unknown[]).includes(value);

/** Timestamps and durations are epoch milliseconds and milliseconds. */
export interface Task extends SyncMeta {
  id: string;
  listId: string | null;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: number | null;
  dueAllDay: boolean;
  durationMs: number | null;
  startedAt: number | null;
  elapsedMs: number;
  completedAt: number | null;
  sortOrder: number;
}

/**
 * The web app's rule (web/src/lib/utils.js isOverdue): a timed task is
 * overdue once its due moment has passed; an all-day task only once its
 * whole day (24 h from the stored midnight) has ended. A completed task is
 * never overdue.
 */
export function isOverdue(
  task: Pick<Task, 'status' | 'dueDate' | 'dueAllDay'>,
  now: number,
): boolean {
  if (task.dueDate === null || task.status === 'completed') {
    return false;
  }
  return task.dueAllDay ? task.dueDate + 86_400_000 <= now : task.dueDate < now;
}
