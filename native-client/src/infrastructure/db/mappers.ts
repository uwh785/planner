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
import type {
  ClassSessionRow,
  EventRow,
  SubtaskRow,
  TagRow,
  TaskListRow,
  TaskRow,
  TaskTagRow,
} from './rows';

const bit = (value: boolean): number => (value ? 1 : 0);
const flag = (value: number): boolean => value !== 0;

export const taskListToRow = (l: TaskList): TaskListRow => ({
  list_id: l.id,
  name: l.name,
  color: l.color,
  icon: l.icon,
  sort_order: l.sortOrder,
  updated_at: l.updatedAt,
  deleted: bit(l.deleted),
});

export const taskListFromRow = (r: TaskListRow): TaskList => ({
  id: r.list_id,
  name: r.name,
  color: r.color,
  icon: r.icon,
  sortOrder: r.sort_order,
  updatedAt: r.updated_at,
  deleted: flag(r.deleted),
});

export const taskToRow = (t: Task): TaskRow => ({
  task_id: t.id,
  list_id: t.listId,
  title: t.title,
  description: t.description,
  priority: t.priority,
  status: t.status,
  due_date: t.dueDate,
  due_all_day: bit(t.dueAllDay),
  duration_ms: t.durationMs,
  started_at: t.startedAt,
  elapsed_ms: t.elapsedMs,
  completed_at: t.completedAt,
  sort_order: t.sortOrder,
  updated_at: t.updatedAt,
  deleted: bit(t.deleted),
});

/** Throws on a status or priority the domain does not know. */
export function taskFromRow(r: TaskRow): Task {
  if (!isTaskStatus(r.status)) {
    throw new Error(`Unknown task status "${r.status}" on task ${r.task_id}`);
  }
  if (!isPriority(r.priority)) {
    throw new Error(`Unknown priority ${r.priority} on task ${r.task_id}`);
  }
  return {
    id: r.task_id,
    listId: r.list_id,
    title: r.title,
    description: r.description,
    priority: r.priority,
    status: r.status,
    dueDate: r.due_date,
    dueAllDay: flag(r.due_all_day),
    durationMs: r.duration_ms,
    startedAt: r.started_at,
    elapsedMs: r.elapsed_ms,
    completedAt: r.completed_at,
    sortOrder: r.sort_order,
    updatedAt: r.updated_at,
    deleted: flag(r.deleted),
  };
}

export const subtaskToRow = (s: Subtask): SubtaskRow => ({
  subtask_id: s.id,
  task_id: s.taskId,
  title: s.title,
  completed: bit(s.completed),
  sort_order: s.sortOrder,
  updated_at: s.updatedAt,
  deleted: bit(s.deleted),
});

export const subtaskFromRow = (r: SubtaskRow): Subtask => ({
  id: r.subtask_id,
  taskId: r.task_id,
  title: r.title,
  completed: flag(r.completed),
  sortOrder: r.sort_order,
  updatedAt: r.updated_at,
  deleted: flag(r.deleted),
});

export const tagToRow = (t: Tag): TagRow => ({
  tag_id: t.id,
  name: t.name,
  color: t.color,
  updated_at: t.updatedAt,
  deleted: bit(t.deleted),
});

export const tagFromRow = (r: TagRow): Tag => ({
  id: r.tag_id,
  name: r.name,
  color: r.color,
  updatedAt: r.updated_at,
  deleted: flag(r.deleted),
});

export const taskTagToRow = (t: TaskTag): TaskTagRow => ({
  task_id: t.taskId,
  tag_id: t.tagId,
  updated_at: t.updatedAt,
  deleted: bit(t.deleted),
});

export const taskTagFromRow = (r: TaskTagRow): TaskTag => ({
  taskId: r.task_id,
  tagId: r.tag_id,
  updatedAt: r.updated_at,
  deleted: flag(r.deleted),
});

export const classSessionToRow = (c: ClassSession): ClassSessionRow => ({
  class_id: c.id,
  subject: c.subject,
  day_of_week: c.dayOfWeek,
  start_minute: c.startMinute,
  end_minute: c.endMinute,
  room: c.room,
  teacher: c.teacher,
  color: c.color,
  updated_at: c.updatedAt,
  deleted: bit(c.deleted),
});

export const classSessionFromRow = (r: ClassSessionRow): ClassSession => ({
  id: r.class_id,
  subject: r.subject,
  dayOfWeek: r.day_of_week,
  startMinute: r.start_minute,
  endMinute: r.end_minute,
  room: r.room,
  teacher: r.teacher,
  color: r.color,
  updatedAt: r.updated_at,
  deleted: flag(r.deleted),
});

export const eventToRow = (e: Event): EventRow => ({
  event_id: e.id,
  title: e.title,
  description: e.description,
  location: e.location,
  start_at: e.startAt,
  end_at: e.endAt,
  all_day: bit(e.allDay),
  color: e.color,
  updated_at: e.updatedAt,
  deleted: bit(e.deleted),
});

export const eventFromRow = (r: EventRow): Event => ({
  id: r.event_id,
  title: r.title,
  description: r.description,
  location: r.location,
  startAt: r.start_at,
  endAt: r.end_at,
  allDay: flag(r.all_day),
  color: r.color,
  updatedAt: r.updated_at,
  deleted: flag(r.deleted),
});
