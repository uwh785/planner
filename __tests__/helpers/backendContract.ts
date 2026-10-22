/**
 * What the backend's POST /api/sync/push decodes for each entity, derived by
 * hand from planner/backend (pkg/model/model.go json tags, pkg/model/validate.go,
 * pkg/app/sync_push.go pushUpsert/pushDelete). Keep in sync when the backend
 * contract changes.
 */
type Check = (v: unknown) => boolean;
const str: Check = v => typeof v === 'string';
const int: Check = v => typeof v === 'number' && Number.isInteger(v);
const bool: Check = v => typeof v === 'boolean';
const nullable =
  (c: Check): Check =>
  v =>
    v === null || c(v);

/** Fields Go decodes from `data`, with the JSON type each must have. */
export const ACCEPTED_FIELDS: Record<string, Record<string, Check>> = {
  list: { name: str, color: str, icon: str, sort_order: int },
  task: {
    list_id: nullable(str),
    title: str,
    description: str,
    priority: int,
    status: str,
    due_date: nullable(int),
    due_all_day: bool,
    duration_ms: nullable(int),
    started_at: nullable(int),
    sort_order: int,
  },
  subtask: { task_id: str, title: str, completed: bool, sort_order: int },
  tag: { name: str, color: str },
  task_tag: { task_id: str, tag_id: str },
  class: {
    subject: str,
    day_of_week: int,
    start_minute: int,
    end_minute: int,
    room: str,
    teacher: str,
    color: str,
  },
  event: {
    title: str,
    description: str,
    location: str,
    start_at: int,
    end_at: nullable(int),
    all_day: bool,
    color: str,
  },
};

const len = (s: unknown) => Buffer.byteLength(String(s ?? ''), 'utf8');
const blank = (s: unknown) => String(s ?? '').trim() === '';

/** Mirrors the Validate* functions; returns the first error or null. */
export function backendValidate(
  entity: string,
  d: Record<string, unknown>,
): string | null {
  switch (entity) {
    case 'list':
      return blank(d.name)
        ? 'name is required'
        : len(d.name) > 100
        ? 'name too long'
        : null;
    case 'tag':
      return blank(d.name)
        ? 'name is required'
        : len(d.name) > 50
        ? 'name too long'
        : null;
    case 'task':
      if (blank(d.title)) return 'title is required';
      if (len(d.title) > 200) return 'title too long';
      return len(d.description) > 5000 ? 'description too long' : null;
    case 'subtask':
      if (blank(d.task_id)) return 'task_id is required';
      if (blank(d.title)) return 'title is required';
      return len(d.title) > 200 ? 'title too long' : null;
    case 'task_tag':
      return blank(d.task_id) || blank(d.tag_id)
        ? 'task_id and tag_id are required'
        : null;
    case 'class': {
      const day = d.day_of_week as number;
      const s = d.start_minute as number;
      const e = d.end_minute as number;
      if (blank(d.subject) || len(d.subject) > 100) return 'subject';
      if (day < 0 || day > 6) return 'day_of_week';
      if (s < 0 || s >= e || e > 1440) return 'minutes';
      return len(d.room) > 100 || len(d.teacher) > 100 ? 'room/teacher' : null;
    }
    case 'event': {
      if (blank(d.title) || len(d.title) > 200) return 'title';
      if (len(d.description) > 5000 || len(d.location) > 200)
        return 'description/location';
      if ((d.start_at as number) <= 0) return 'start_at is required';
      if (d.end_at != null && (d.end_at as number) < (d.start_at as number))
        return 'end_at';
      return null;
    }
  }
  return `unknown entity ${entity}`;
}

/** Delete bodies the backend reads (pushDelete): subtask and task_tag need parents. */
export const DELETE_FIELDS: Record<string, string[]> = {
  list: [],
  task: [],
  tag: [],
  class: [],
  event: [],
  subtask: ['task_id'],
  task_tag: ['task_id', 'tag_id'],
};

export const ENTITIES = Object.keys(ACCEPTED_FIELDS);
export const PUSH_OPS = ['upsert', 'delete'];
