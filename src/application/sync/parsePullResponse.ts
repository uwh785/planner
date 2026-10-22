import {
  isPriority,
  isTaskStatus,
  type ClassSession,
  type Event,
  type Subtask,
  type Tag,
  type Task,
  type TaskList,
  type TaskTag,
} from '@/domain';

/** A parsed collection: the valid rows and how many were malformed. */
export interface Parsed<T> {
  rows: T[];
  invalid: number;
}

export interface ParsedPull {
  /** Null when the response carried no usable cursor. */
  cursor: number | null;
  lists: Parsed<TaskList>;
  tasks: Parsed<Task>;
  subtasks: Parsed<Subtask>;
  tags: Parsed<Tag>;
  taskTags: Parsed<TaskTag>;
  classes: Parsed<ClassSession>;
  events: Parsed<Event>;
}

type Wire = Record<string, unknown>;

const isObject = (v: unknown): v is Wire =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const text = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : fallback;
const nonEmpty = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v : null;
const int = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback;
const intOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null;
/** JSON booleans, but tolerate 0/1 too. */
const flag = (v: unknown): boolean => v === true || v === 1;

function collect<T>(
  value: unknown,
  parseRow: (row: Wire) => T | null,
): Parsed<T> {
  const out: Parsed<T> = { rows: [], invalid: 0 };
  if (!Array.isArray(value)) {
    return out;
  }
  for (const item of value) {
    const row = isObject(item) ? parseRow(item) : null;
    if (row === null) {
      out.invalid += 1;
    } else {
      out.rows.push(row);
    }
  }
  return out;
}

const meta = (r: Wire) => ({
  updatedAt: int(r.updated_at),
  deleted: flag(r.deleted),
});

/**
 * Reads a `GET /api/sync` body defensively: unknown fields are ignored,
 * missing or mistyped collections are empty, rows that cannot be stored are
 * counted as invalid instead of failing the whole pull. Throws only when the
 * body itself is not an object.
 */
export function parsePullResponse(body: unknown): ParsedPull {
  if (!isObject(body)) {
    throw new Error('Pull response must be a JSON object');
  }
  const cursor = intOrNull(body.cursor);
  return {
    cursor: cursor !== null && cursor >= 0 ? cursor : null,
    lists: collect(body.lists, r => {
      const id = nonEmpty(r.list_id);
      return id === null
        ? null
        : {
            id,
            name: text(r.name),
            color: text(r.color),
            icon: text(r.icon),
            sortOrder: int(r.sort_order),
            ...meta(r),
          };
    }),
    tasks: collect(body.tasks, r => {
      const id = nonEmpty(r.task_id);
      const status = r.status === undefined ? 'pending' : r.status;
      const priority = r.priority === undefined ? 0 : r.priority;
      if (id === null || !isTaskStatus(status) || !isPriority(priority)) {
        return null;
      }
      return {
        id,
        listId: nonEmpty(r.list_id),
        title: text(r.title),
        description: text(r.description),
        priority,
        status,
        dueDate: intOrNull(r.due_date),
        dueAllDay: flag(r.due_all_day),
        durationMs: intOrNull(r.duration_ms),
        startedAt: intOrNull(r.started_at),
        elapsedMs: int(r.elapsed_ms),
        completedAt: intOrNull(r.completed_at),
        sortOrder: int(r.sort_order),
        ...meta(r),
      };
    }),
    subtasks: collect(body.subtasks, r => {
      const id = nonEmpty(r.subtask_id);
      const taskId = nonEmpty(r.task_id);
      return id === null || taskId === null
        ? null
        : {
            id,
            taskId,
            title: text(r.title),
            completed: flag(r.completed),
            sortOrder: int(r.sort_order),
            ...meta(r),
          };
    }),
    tags: collect(body.tags, r => {
      const id = nonEmpty(r.tag_id);
      return id === null
        ? null
        : { id, name: text(r.name), color: text(r.color), ...meta(r) };
    }),
    taskTags: collect(body.task_tags, r => {
      const taskId = nonEmpty(r.task_id);
      const tagId = nonEmpty(r.tag_id);
      return taskId === null || tagId === null
        ? null
        : { taskId, tagId, ...meta(r) };
    }),
    classes: collect(body.classes, r => {
      const id = nonEmpty(r.class_id);
      const day = intOrNull(r.day_of_week);
      const start = intOrNull(r.start_minute);
      const end = intOrNull(r.end_minute);
      // The local table CHECKs these; a row that breaks them is invalid.
      if (
        id === null ||
        day === null ||
        start === null ||
        end === null ||
        day < 0 ||
        day > 6 ||
        start < 0 ||
        start >= end ||
        end > 1440
      ) {
        return null;
      }
      return {
        id,
        subject: text(r.subject),
        dayOfWeek: day,
        startMinute: start,
        endMinute: end,
        room: text(r.room),
        teacher: text(r.teacher),
        color: text(r.color),
        ...meta(r),
      };
    }),
    events: collect(body.events, r => {
      const id = nonEmpty(r.event_id);
      const startAt = intOrNull(r.start_at);
      const endAt = intOrNull(r.end_at);
      if (
        id === null ||
        startAt === null ||
        (endAt !== null && endAt < startAt)
      ) {
        return null;
      }
      return {
        id,
        title: text(r.title),
        description: text(r.description),
        location: text(r.location),
        startAt,
        endAt,
        allDay: flag(r.all_day),
        color: text(r.color),
        ...meta(r),
      };
    }),
  };
}
