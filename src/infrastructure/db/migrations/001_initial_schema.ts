import type { Migration } from './runner';

/**
 * Local mirror of the backend sync schema, without `user_id` (one database
 * file per user), foreign keys (a pull can deliver children before parents,
 * and tombstones outlive their parents) and the server-only tables
 * (app_users, subscription, refresh_tokens, sync_changes). Booleans are
 * INTEGER 0/1, timestamps epoch milliseconds. The backend has no CHECKs on
 * task status or priority, so none here either: the domain narrows them.
 */
export const initialSchema: Migration = {
  version: 1,
  name: 'initial schema',
  statements: [
    `CREATE TABLE task_lists (
      list_id    TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL DEFAULT '#0A84FF',
      icon       TEXT NOT NULL DEFAULT 'list',
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      deleted    INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE tasks (
      task_id      TEXT PRIMARY KEY,
      list_id      TEXT,
      title        TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      priority     INTEGER NOT NULL DEFAULT 0,
      status       TEXT NOT NULL DEFAULT 'pending',
      due_date     INTEGER,
      due_all_day  INTEGER NOT NULL DEFAULT 0,
      duration_ms  INTEGER,
      started_at   INTEGER,
      elapsed_ms   INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      updated_at   INTEGER NOT NULL DEFAULT 0,
      deleted      INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE subtasks (
      subtask_id TEXT PRIMARY KEY,
      task_id    TEXT NOT NULL,
      title      TEXT NOT NULL,
      completed  INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      deleted    INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE tags (
      tag_id     TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL DEFAULT '#8E8E93',
      updated_at INTEGER NOT NULL DEFAULT 0,
      deleted    INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE task_tags (
      task_id    TEXT NOT NULL,
      tag_id     TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT 0,
      deleted    INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (task_id, tag_id)
    )`,
    `CREATE TABLE class_sessions (
      class_id     TEXT PRIMARY KEY,
      subject      TEXT NOT NULL,
      day_of_week  INTEGER NOT NULL,
      start_minute INTEGER NOT NULL,
      end_minute   INTEGER NOT NULL,
      room         TEXT NOT NULL DEFAULT '',
      teacher      TEXT NOT NULL DEFAULT '',
      color        TEXT NOT NULL DEFAULT '#0A84FF',
      updated_at   INTEGER NOT NULL DEFAULT 0,
      deleted      INTEGER NOT NULL DEFAULT 0,
      CHECK (day_of_week >= 0 AND day_of_week <= 6),
      CHECK (start_minute >= 0 AND start_minute < end_minute AND end_minute <= 1440)
    )`,
    `CREATE TABLE events (
      event_id    TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      location    TEXT NOT NULL DEFAULT '',
      start_at    INTEGER NOT NULL,
      end_at      INTEGER,
      all_day     INTEGER NOT NULL DEFAULT 0,
      color       TEXT NOT NULL DEFAULT '#0A84FF',
      updated_at  INTEGER NOT NULL DEFAULT 0,
      deleted     INTEGER NOT NULL DEFAULT 0,
      CHECK (end_at IS NULL OR end_at >= start_at)
    )`,
    // Local-only: pull cursor, last successful sync time, etc.
    `CREATE TABLE sync_state (
      key   TEXT PRIMARY KEY,
      value TEXT
    )`,
    // Local-only: changes waiting to be pushed, in creation order.
    `CREATE TABLE outbox (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      entity     TEXT NOT NULL,
      op         TEXT NOT NULL,
      entity_id  TEXT NOT NULL,
      payload    TEXT NOT NULL DEFAULT '{}',
      change_id  TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      attempts   INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      status     TEXT NOT NULL DEFAULT 'pending'
    )`,
    // Partial indexes: UI reads always filter out tombstones.
    `CREATE INDEX idx_tasks_list ON tasks(list_id, sort_order) WHERE deleted = 0`,
    `CREATE INDEX idx_tasks_status ON tasks(status) WHERE deleted = 0`,
    `CREATE INDEX idx_tasks_due ON tasks(due_date) WHERE deleted = 0`,
    `CREATE INDEX idx_subtasks_task ON subtasks(task_id, sort_order) WHERE deleted = 0`,
    `CREATE INDEX idx_task_tags_tag ON task_tags(tag_id) WHERE deleted = 0`,
    `CREATE INDEX idx_class_sessions_day ON class_sessions(day_of_week, start_minute) WHERE deleted = 0`,
    `CREATE INDEX idx_events_start ON events(start_at) WHERE deleted = 0`,
    `CREATE INDEX idx_outbox_status_id ON outbox(status, id)`,
  ],
};
