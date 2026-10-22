/** SQL row shapes: snake_case columns, booleans as 0/1. */
interface SyncColumns {
  updated_at: number;
  deleted: number;
}

export interface TaskListRow extends SyncColumns {
  list_id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
}

export interface TaskRow extends SyncColumns {
  task_id: string;
  list_id: string | null;
  title: string;
  description: string;
  priority: number;
  status: string;
  due_date: number | null;
  due_all_day: number;
  duration_ms: number | null;
  started_at: number | null;
  elapsed_ms: number;
  completed_at: number | null;
  sort_order: number;
}

export interface SubtaskRow extends SyncColumns {
  subtask_id: string;
  task_id: string;
  title: string;
  completed: number;
  sort_order: number;
}

export interface TagRow extends SyncColumns {
  tag_id: string;
  name: string;
  color: string;
}

export interface TaskTagRow extends SyncColumns {
  task_id: string;
  tag_id: string;
}

export interface ClassSessionRow extends SyncColumns {
  class_id: string;
  subject: string;
  day_of_week: number;
  start_minute: number;
  end_minute: number;
  room: string;
  teacher: string;
  color: string;
}

export interface EventRow extends SyncColumns {
  event_id: string;
  title: string;
  description: string;
  location: string;
  start_at: number;
  end_at: number | null;
  all_day: number;
  color: string;
}
