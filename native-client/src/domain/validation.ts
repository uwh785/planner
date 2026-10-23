import type { ClassSession } from './classSession';
import type { Event } from './event';
import type { Subtask } from './subtask';
import type { Tag } from './tag';
import type { Task } from './task';
import type { TaskList } from './taskList';

/**
 * Local mirror of the backend's Validate* rules (pkg/model/validate.go,
 * class.go, event.go). A row the server would refuse must not be written
 * locally, or its outbox entry would fail on every push. Limits count UTF-8
 * bytes, like the backend's Go `len`.
 */
/** Which rule a field broke, so a screen can word it in the user's language. */
export interface ValidationDetail {
  code: 'required' | 'tooLong';
  field: string;
  /** The limit for `tooLong`. */
  max?: number;
}

export class ValidationError extends Error {
  constructor(message: string, readonly detail?: ValidationDetail) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const LIMITS = {
  taskTitle: 200,
  taskDescription: 5000,
  listName: 100,
  tagName: 50,
  subtaskTitle: 200,
  eventLocation: 200,
  classText: 100,
} as const;

export const DEFAULT_COLORS = {
  list: '#0A84FF',
  tag: '#8E8E93',
  classSession: '#0A84FF',
  event: '#0A84FF',
} as const;
export const DEFAULT_LIST_ICON = 'list';

export function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

function required(value: string, field: string, max: number): string {
  const text = value.trim();
  if (text === '') {
    throw new ValidationError(`${field} is required`, {
      code: 'required',
      field,
    });
  }
  return capped(text, field, max);
}

function capped(value: string, field: string, max: number): string {
  if (utf8Length(value) > max) {
    throw new ValidationError(`${field} must be ${max} characters or fewer`, {
      code: 'tooLong',
      field,
      max,
    });
  }
  return value;
}

export const normalizeTaskList = (l: TaskList): TaskList => ({
  ...l,
  name: required(l.name, 'name', LIMITS.listName),
  color: l.color || DEFAULT_COLORS.list,
  icon: l.icon || DEFAULT_LIST_ICON,
});

export const normalizeTask = (t: Task): Task => ({
  ...t,
  title: required(t.title, 'title', LIMITS.taskTitle),
  description: capped(t.description, 'description', LIMITS.taskDescription),
});

export const normalizeSubtask = (s: Subtask): Subtask => {
  if (s.taskId.trim() === '') {
    throw new ValidationError('task_id is required');
  }
  return { ...s, title: required(s.title, 'title', LIMITS.subtaskTitle) };
};

export const normalizeTag = (t: Tag): Tag => ({
  ...t,
  name: required(t.name, 'name', LIMITS.tagName),
  color: t.color || DEFAULT_COLORS.tag,
});

export function normalizeClassSession(c: ClassSession): ClassSession {
  const subject = required(
    c.subject.toUpperCase(),
    'subject',
    LIMITS.classText,
  );
  if (!Number.isInteger(c.dayOfWeek) || c.dayOfWeek < 0 || c.dayOfWeek > 6) {
    throw new ValidationError('day_of_week must be between 0 and 6');
  }
  if (
    !Number.isInteger(c.startMinute) ||
    !Number.isInteger(c.endMinute) ||
    c.startMinute < 0 ||
    c.startMinute >= c.endMinute ||
    c.endMinute > 1440
  ) {
    throw new ValidationError(
      'start_minute and end_minute must satisfy 0 <= start_minute < end_minute <= 1440',
    );
  }
  return {
    ...c,
    subject,
    room: capped(c.room.trim(), 'room', LIMITS.classText),
    teacher: capped(c.teacher.trim(), 'teacher', LIMITS.classText),
    color: c.color || DEFAULT_COLORS.classSession,
  };
}

export function normalizeEvent(e: Event): Event {
  const title = required(e.title, 'title', LIMITS.taskTitle);
  const description = capped(
    e.description.trim(),
    'description',
    LIMITS.taskDescription,
  );
  const location = capped(e.location.trim(), 'location', LIMITS.eventLocation);
  if (!Number.isInteger(e.startAt) || e.startAt <= 0) {
    throw new ValidationError('start_at is required');
  }
  if (e.endAt !== null && e.endAt < e.startAt) {
    throw new ValidationError('end_at must not be before start_at');
  }
  return {
    ...e,
    title,
    description,
    location,
    color: e.color || DEFAULT_COLORS.event,
  };
}

/** A referenced entity does not exist (or is deleted) locally. */
export class NotFoundError extends Error {
  constructor(message: string, readonly entity?: 'task' | 'list' | 'subtask') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * A timer transition the task's current status does not allow (backend
 * `ErrInvalidTransition`): start needs pending, pause needs in progress,
 * complete needs pending or in progress. Nothing is changed when it is thrown.
 */
export class InvalidTransitionError extends Error {
  constructor(
    readonly op: 'start' | 'pause' | 'complete',
    readonly from: 'pending' | 'in_progress' | 'completed',
  ) {
    super(`Cannot ${op} a task that is ${from}`);
    this.name = 'InvalidTransitionError';
  }
}
