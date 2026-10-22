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
