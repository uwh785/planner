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
 * A task started, paused or completed here travels as the timer ops `start`,
 * `pause` and `complete` (see OutboxWriter.transition), never as a status or
 * a start in an upsert. The server's update ignores both, but its create
 * takes them as given: a create that already said `in_progress` or
 * `completed` would make the later transitions conflict (or measure from the
 * wrong start) and lose the real moments. So an upsert always describes the
 * task as freshly pending with no start; the transitions that follow it, in
 * order, carry the rest.
 */
export const taskPayload = (t: Task): Body => ({
  list_id: t.listId,
  title: t.title,
  description: t.description,
  priority: t.priority,
  status: 'pending',
  due_date: t.dueDate,
  due_all_day: t.dueAllDay,
  duration_ms: t.durationMs,
  started_at: null,
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
