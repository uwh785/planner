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

type TimerFields = Pick<Task, 'status' | 'startedAt' | 'elapsedMs'>;

/**
 * How much of the countdown has run (web `getElapsedMs`): what earlier
 * segments accumulated, plus the running segment while the task is in
 * progress and started. A paused task has no start, so it stays frozen.
 */
export function elapsedMs(task: TimerFields, now: number): number {
  if (task.status === 'in_progress' && task.startedAt !== null) {
    return task.elapsedMs + Math.max(now - task.startedAt, 0);
  }
  return task.elapsedMs;
}

/** 0 to 1 (web `getProgressPercent`): a completed task is full. */
export function timerProgress(
  task: TimerFields & Pick<Task, 'durationMs'>,
  now: number,
): number {
  if (task.status === 'completed') {
    return 1;
  }
  if (!task.durationMs) {
    return 0;
  }
  return Math.min(elapsedMs(task, now) / task.durationMs, 1);
}

/** Milliseconds left (web `getRemainingMs`); 0 when done or without a duration. */
export function remainingMs(
  task: TimerFields & Pick<Task, 'durationMs'>,
  now: number,
): number {
  if (task.status === 'completed' || !task.durationMs) {
    return 0;
  }
  return Math.max(task.durationMs - elapsedMs(task, now), 0);
}
