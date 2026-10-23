import type {
  ClassSession,
  Event,
  Subtask,
  Tag,
  Task,
  TaskList,
} from '@/domain';

/**
 * The `data` of each push change, snake_case, as the backend decodes it
 * (pkg/app/sync_push.go pushUpsert). The id travels in the change itself, and
 * server-managed fields (user_id, updated_at, elapsed_ms, completed_at) are
 * left out: the server stamps them, and timer fields change only through
 * transitions.
 */
type Body = Record<string, string | number | boolean | null>;

export const listPayload = (l: TaskList): Body => ({
  name: l.name,
  color: l.color,
  icon: l.icon,
  sort_order: l.sortOrder,
});

/**
 * A task completed here travels as the timer op `complete` (see
 * OutboxWriter.complete), never as a status in an upsert: a create that
 * already said `completed` would make the server refuse the later `complete`
 * as a conflict and lose the real moment. So a task with a `completedAt`
 * is described as pending; the server ignores the status of an update anyway.
 */
const wireStatus = (t: Task): string =>
  t.status === 'completed' && t.completedAt !== null ? 'pending' : t.status;

export const taskPayload = (t: Task): Body => ({
  list_id: t.listId,
  title: t.title,
  description: t.description,
  priority: t.priority,
  status: wireStatus(t),
  due_date: t.dueDate,
  due_all_day: t.dueAllDay,
  duration_ms: t.durationMs,
  started_at: t.startedAt,
  sort_order: t.sortOrder,
});

export const subtaskPayload = (s: Subtask): Body => ({
  task_id: s.taskId,
  title: s.title,
  completed: s.completed,
  sort_order: s.sortOrder,
});

export const tagPayload = (t: Tag): Body => ({
  name: t.name,
  color: t.color,
});

export const taskTagPayload = (taskId: string, tagId: string): Body => ({
  task_id: taskId,
  tag_id: tagId,
});

export const classPayload = (c: ClassSession): Body => ({
  subject: c.subject,
  day_of_week: c.dayOfWeek,
  start_minute: c.startMinute,
  end_minute: c.endMinute,
  room: c.room,
  teacher: c.teacher,
  color: c.color,
});

export const eventPayload = (e: Event): Body => ({
  title: e.title,
  description: e.description,
  location: e.location,
  start_at: e.startAt,
  end_at: e.endAt,
  all_day: e.allDay,
  color: e.color,
});
