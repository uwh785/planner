import type { SyncMeta } from './syncMeta';
import { InvalidTransitionError, ValidationError } from './validation';

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

/** The fields a timer transition changes. */
export type TimerState = Pick<
  Task,
  'status' | 'startedAt' | 'elapsedMs' | 'completedAt'
>;

/**
 * The moment a transition happened must be a positive epoch-ms integer, as
 * the backend requires of `at` (zero would mean "the server's clock", which
 * would credit the time of the sync instead of the tap).
 */
function requireMoment(at: number): void {
  if (!Number.isSafeInteger(at) || at <= 0) {
    throw new ValidationError(
      'at must be a positive unix time in milliseconds',
    );
  }
}

/** The running segment a start at `startedAt` accrued by `at` (never negative). */
const segment = (startedAt: number | null, at: number): number =>
  startedAt === null ? 0 : Math.max(at - startedAt, 0);

/**
 * Start (backend `StartTask`): only a pending task starts. It becomes in
 * progress with `startedAt = at`; what it accumulated before is kept, so a
 * start after a pause resumes the countdown instead of restarting it.
 */
export function startTimer(task: TimerState, at: number): TimerState {
  requireMoment(at);
  if (task.status !== 'pending') {
    throw new InvalidTransitionError('start', task.status);
  }
  return { ...task, status: 'in_progress', startedAt: at };
}

/**
 * Pause (backend `PauseTask`): only an in-progress task pauses. The segment
 * just run (`at - startedAt`, floored at zero) joins `elapsedMs`, `startedAt`
 * is cleared and the status goes back to `pending`.
 */
export function pauseTimer(task: TimerState, at: number): TimerState {
  requireMoment(at);
  if (task.status !== 'in_progress') {
    throw new InvalidTransitionError('pause', task.status);
  }
  return {
    ...task,
    status: 'pending',
    startedAt: null,
    elapsedMs: task.elapsedMs + segment(task.startedAt, at),
  };
}

/**
 * Complete (backend `CompleteTask`): a pending or in-progress task completes
 * with `completedAt = at`. A running segment joins `elapsedMs`, as in a
 * pause; a pending task keeps what it accumulated.
 */
export function completeTimer(task: TimerState, at: number): TimerState {
  requireMoment(at);
  if (task.status === 'completed') {
    throw new InvalidTransitionError('complete', task.status);
  }
  return {
    ...task,
    status: 'completed',
    completedAt: at,
    startedAt: null,
    elapsedMs:
      task.elapsedMs +
      (task.status === 'in_progress' ? segment(task.startedAt, at) : 0),
  };
}
